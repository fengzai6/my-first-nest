import type { AxiosInstance, InternalAxiosRequestConfig } from "axios";
import axios, { AxiosError } from "axios";
import { DedupeManager } from "./dedupe-manager";
import { REFRESH_SKIPPED, TokenRefreshManager } from "./token-refresh-manager";
import type { AccessTokenResult } from "./types/token";
import type { RequestRetryState } from "./types/common";
import type {
  HttpClientOptions,
  ResolvedHttpClientOptions,
} from "./types/http-client-options";
import { DEFAULT_MESSAGES, DEFAULT_REFRESH_BUFFER_MS } from "./constants";
import { normalizeError, invokeOnError } from "./utils/error";
import {
  formatAccessToken,
  normalizeTokenResult,
  isTokenExpiringSoon,
} from "./utils/token";
import {
  shouldSkipRefresh,
  defaultIsRefreshFailure,
  resolveRetryPolicy,
} from "./utils/refresh";

export const createHttpClient = <
  T extends AccessTokenResult = AccessTokenResult,
>(
  options: HttpClientOptions<T>,
): AxiosInstance => {
  const resolvedOptions: ResolvedHttpClientOptions<T> = {
    accessTokenHeaderName: "Authorization",
    accessTokenPrefix: "Bearer",
    refreshFailureCodes: [],
    unauthorizedStatusCode: 401,
    errorMessages: {},
    isRefreshFailure: (error: unknown) =>
      defaultIsRefreshFailure(error, {
        unauthorizedStatusCode: resolvedOptions.unauthorizedStatusCode,
        refreshFailureCodes: resolvedOptions.refreshFailureCodes,
      }),
    skipRefreshUrls: [],
    refreshBufferMs: DEFAULT_REFRESH_BUFFER_MS,
    shouldRefreshByResponseData: () => false,
    ...options,
  };

  const refreshManager =
    options.refreshManager ??
    new TokenRefreshManager(options.refreshCooldownMs);
  const refreshEnabled = options.refreshAccessToken !== undefined;
  const resolvedRetryPolicy = resolveRetryPolicy(options.retryPolicy);

  // 请求合并（in-flight coalesce）
  const dedupePolicy = options.dedupePolicy;
  const dedupeManager = dedupePolicy?.enabled
    ? new DedupeManager(dedupePolicy.generateKey)
    : null;

  const instance = axios.create({
    timeout: 15 * 1000,
    ...resolvedOptions.axiosConfig,
  });

  // 包装 request 方法，实现请求合并（仅 GET）
  // 内部 refresh / retry 通过 originalRequest 旁路 dedupe，避免 pending 自引用死锁
  const originalRequest = instance.request.bind(instance);
  if (dedupeManager) {
    instance.request = ((
      config: InternalAxiosRequestConfig & RequestRetryState,
    ) => {
      const method = (config.method ?? "get").toLowerCase();
      if (method !== "get" || config.__skipDedupe) {
        return originalRequest(config);
      }

      // 请求级配置覆盖客户端级配置
      const requestDedupePolicy = config.dedupePolicy;
      const shouldDedupe = requestDedupePolicy?.enabled ?? true;

      if (!shouldDedupe) {
        return originalRequest(config);
      }

      const key = dedupeManager.getKey(config);
      const pendingPromise = dedupeManager.getPending(key);

      if (pendingPromise) {
        return pendingPromise as ReturnType<typeof originalRequest>;
      }

      const promise = originalRequest(config);
      dedupeManager.setPending(key, promise);
      return promise;
    }) as typeof instance.request;
  }

  const handleAuthFailure = async (error?: unknown) => {
    await resolvedOptions.onAuthFailure?.(error);
  };

  const refreshAccessToken = async (): Promise<
    AccessTokenResult | typeof REFRESH_SKIPPED
  > => {
    const requestRefreshAccessToken = resolvedOptions.refreshAccessToken;

    if (!refreshEnabled || !requestRefreshAccessToken) {
      throw new Error(DEFAULT_MESSAGES.refreshDisabled);
    }

    const rejectRefreshAuthFailure = async (): Promise<never> => {
      const authError = new Error(
        resolvedOptions.errorMessages?.refreshTokenExpired ??
          DEFAULT_MESSAGES.refreshTokenExpired,
      );
      await handleAuthFailure(authError);
      throw await invokeOnError(
        authError,
        { type: "refresh" },
        resolvedOptions.onError,
      );
    };

    return refreshManager.runRefresh(async () => {
      let result: AccessTokenResult;

      try {
        result = await requestRefreshAccessToken();
      } catch (error) {
        const normalizedError = normalizeError(error);
        const isAuthFailure = resolvedOptions.isRefreshFailure(error);

        if (isAuthFailure) {
          await rejectRefreshAuthFailure();
        }

        // 非鉴权失败（如网络错误 / 编程错误），不调用 handleAuthFailure
        throw await invokeOnError(
          normalizedError,
          { type: "refresh" },
          resolvedOptions.onError,
        );
      }

      const { token } = normalizeTokenResult(result);

      // 空 token 视为刷新鉴权失败：不写冷却，不重试业务请求
      if (!token) {
        await rejectRefreshAuthFailure();
      }

      return result;
    });
  };

  const retryAfterRefresh = async (
    config: InternalAxiosRequestConfig & RequestRetryState,
  ) => {
    if (config._retry) {
      const authError = new Error(
        resolvedOptions.errorMessages?.loginExpired ??
          DEFAULT_MESSAGES.loginExpired,
      );
      await handleAuthFailure(authError);
      throw await invokeOnError(
        authError,
        { type: "refresh" },
        resolvedOptions.onError,
      );
    }

    config._retry = true;

    const refreshResult = await refreshAccessToken();

    // 冷却期内跳过刷新时重新获取 token，否则使用刷新结果
    const tokenSource =
      refreshResult === REFRESH_SKIPPED
        ? await resolvedOptions.getAccessToken()
        : refreshResult;
    const { token } = normalizeTokenResult(tokenSource);

    // 冷却跳过或刷新结果为空 token 时，不再重试原请求
    if (!token) {
      const authError = new Error(
        resolvedOptions.errorMessages?.loginExpired ??
          DEFAULT_MESSAGES.loginExpired,
      );
      await handleAuthFailure(authError);
      throw await invokeOnError(
        authError,
        { type: "refresh" },
        resolvedOptions.onError,
      );
    }

    config.headers = config.headers ?? {};
    config.headers[resolvedOptions.accessTokenHeaderName] = formatAccessToken(
      resolvedOptions.accessTokenPrefix,
      token,
    );

    // 内部重试旁路 dedupe：当前请求 Promise 仍在 pending map 中
    config.__skipDedupe = true;
    return originalRequest(config);
  };

  instance.interceptors.request.use(
    async (config: InternalAxiosRequestConfig & RequestRetryState) => {
      const currentAuthorization =
        config.headers?.[resolvedOptions.accessTokenHeaderName];

      // 仅在没有显式 Authorization 时注入 token，并判断是否主动刷新
      if (!currentAuthorization) {
        const tokenResult = await resolvedOptions.getAccessToken();
        const { token, expiresAt } = normalizeTokenResult(tokenResult);

        if (token) {
          // 主动刷新：token 即将过期时异步触发刷新，不阻塞当前请求
          if (
            refreshEnabled &&
            expiresAt &&
            !shouldSkipRefresh(resolvedOptions.skipRefreshUrls, config)
          ) {
            const bufferMs = resolvedOptions.refreshBufferMs;

            if (bufferMs > 0 && isTokenExpiringSoon(expiresAt, bufferMs)) {
              // fire-and-forget：refreshAccessToken 内部已调用 onError/onAuthFailure
              // 这里仅吞掉 rejection，避免 unhandledrejection，且不阻塞当前请求
              void refreshAccessToken().catch(() => {});
            }
          }

          config.headers = config.headers ?? {};
          config.headers[resolvedOptions.accessTokenHeaderName] =
            formatAccessToken(resolvedOptions.accessTokenPrefix, token);
        }
      }

      // 合并运行时动态 headers（即使已有 Authorization 也要执行）
      if (resolvedOptions.headersProvider) {
        config.headers = config.headers ?? {};
        const runtimeHeaders = await resolvedOptions.headersProvider();
        Object.assign(config.headers, runtimeHeaders);
      }

      return config;
    },
    (error) => Promise.reject(error),
  );

  instance.interceptors.response.use(
    async (response) => {
      const config = response.config as InternalAxiosRequestConfig &
        RequestRetryState;

      if (
        resolvedOptions.shouldRefreshByResponseData(response) &&
        refreshEnabled &&
        !shouldSkipRefresh(resolvedOptions.skipRefreshUrls, config)
      ) {
        return retryAfterRefresh(config);
      }

      if (resolvedOptions.onBusinessResponse) {
        const businessResult =
          await resolvedOptions.onBusinessResponse(response);

        if (businessResult instanceof Error) {
          throw businessResult;
        }

        // 仅接受完整 AxiosResponse 形态，避免 {status,data} 业务对象被误替换
        if (
          businessResult &&
          typeof businessResult === "object" &&
          "status" in businessResult &&
          "data" in businessResult &&
          "config" in businessResult &&
          "headers" in businessResult &&
          "statusText" in businessResult
        ) {
          return businessResult;
        }
      }

      return response;
    },
    async (error: AxiosError) => {
      const config = error.config as
        | (InternalAxiosRequestConfig & RequestRetryState)
        | undefined;

      const normalizedError = normalizeError(error);

      if (!config) {
        const finalError = await invokeOnError(
          normalizedError,
          { type: "request" },
          resolvedOptions.onError,
        );
        return Promise.reject(finalError);
      }

      const status = error.response?.status;

      // 鉴权失败优先于通用重试，避免 401 被 shouldRetry 空耗重试次数
      if (status === resolvedOptions.unauthorizedStatusCode) {
        if (
          !refreshEnabled ||
          shouldSkipRefresh(resolvedOptions.skipRefreshUrls, config)
        ) {
          await handleAuthFailure(normalizedError);
          const finalError = await invokeOnError(
            normalizedError,
            { type: "request" },
            resolvedOptions.onError,
          );
          return Promise.reject(finalError);
        }

        try {
          return await retryAfterRefresh(config);
        } catch (refreshError) {
          return Promise.reject(refreshError);
        }
      }

      // 通用重试逻辑（仅处理非鉴权失败）
      if (resolvedRetryPolicy) {
        const retryCount = config.__retryCount ?? 0;

        if (
          retryCount < resolvedRetryPolicy.maxRetries &&
          resolvedRetryPolicy.shouldRetry(error, retryCount)
        ) {
          const delay = resolvedRetryPolicy.retryDelay(retryCount);
          config.__retryCount = retryCount + 1;

          await new Promise((resolve) => setTimeout(resolve, delay));
          // 内部重试旁路 dedupe：当前请求 Promise 仍在 pending map 中
          config.__skipDedupe = true;
          return originalRequest(config);
        }
      }

      const finalError = await invokeOnError(
        normalizedError,
        { type: "request" },
        resolvedOptions.onError,
      );
      return Promise.reject(finalError);
    },
  );

  return instance;
};
