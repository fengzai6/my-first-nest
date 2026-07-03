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
    authFailureCodes: [],
    unauthorizedStatusCode: 401,
    errorMessages: {},
    isRefreshFailure: (error: unknown) =>
      defaultIsRefreshFailure(error, {
        unauthorizedStatusCode: resolvedOptions.unauthorizedStatusCode,
        authFailureCodes: resolvedOptions.authFailureCodes,
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

  // 请求合并
  const dedupePolicy = options.dedupePolicy;
  const dedupeManager = dedupePolicy?.enabled
    ? new DedupeManager(dedupePolicy.windowMs, dedupePolicy.generateKey)
    : null;

  const instance = axios.create({
    timeout: 15 * 1000,
    ...resolvedOptions.axiosConfig,
  });

  // 包装 request 方法，实现请求合并
  if (dedupeManager) {
    const originalRequest = instance.request.bind(instance);
    instance.request = ((config: InternalAxiosRequestConfig) => {
      // 只对 GET 请求进行合并
      const method = (config.method ?? "get").toLowerCase();
      if (method !== "get") {
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

    return refreshManager.runRefresh(async () => {
      try {
        return await requestRefreshAccessToken();
      } catch (error) {
        const normalizedError = normalizeError(error);
        const isAuthFailure = resolvedOptions.isRefreshFailure(error);

        if (isAuthFailure) {
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
        }

        // 非鉴权失败（如网络错误），不调用 handleAuthFailure
        throw await invokeOnError(
          normalizedError,
          { type: "refresh" },
          resolvedOptions.onError,
        );
      }
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

    try {
      const refreshResult = await refreshAccessToken();

      // 冷却期内跳过刷新时重新获取 token，否则使用刷新结果
      const tokenSource =
        refreshResult === REFRESH_SKIPPED
          ? await resolvedOptions.getAccessToken()
          : refreshResult;
      const { token } = normalizeTokenResult(tokenSource);

      config.headers = config.headers ?? {};
      config.headers[resolvedOptions.accessTokenHeaderName] = formatAccessToken(
        resolvedOptions.accessTokenPrefix,
        token,
      );

      return await instance.request(config);
    } catch (error) {
      throw await invokeOnError(
        normalizeError(error),
        { type: "refresh" },
        resolvedOptions.onError,
      );
    }
  };

  instance.interceptors.request.use(
    async (config: InternalAxiosRequestConfig & RequestRetryState) => {
      const currentAuthorization =
        config.headers?.[resolvedOptions.accessTokenHeaderName];

      if (currentAuthorization) {
        return config;
      }

      const tokenResult = await resolvedOptions.getAccessToken();
      const { token, expiresAt } = normalizeTokenResult(tokenResult);

      if (!token) return config;

      // 主动刷新：token 即将过期时异步触发刷新，不阻塞当前请求
      if (
        refreshEnabled &&
        expiresAt &&
        !shouldSkipRefresh(resolvedOptions.skipRefreshUrls, config)
      ) {
        const bufferMs = resolvedOptions.refreshBufferMs;

        if (bufferMs > 0 && isTokenExpiringSoon(expiresAt, bufferMs)) {
          refreshAccessToken().catch(() => {});
        }
      }

      config.headers = config.headers ?? {};
      config.headers[resolvedOptions.accessTokenHeaderName] = formatAccessToken(
        resolvedOptions.accessTokenPrefix,
        token,
      );

      // 合并运行时动态 headers
      if (resolvedOptions.headersProvider) {
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

        // 返回了新响应（通过检查 AxiosResponse 核心属性判断）
        if (
          businessResult &&
          typeof businessResult === "object" &&
          "status" in businessResult &&
          "data" in businessResult
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

      // 通用重试逻辑（在 token 刷新之前判断）
      if (resolvedRetryPolicy) {
        const retryCount = config.__retryCount ?? 0;

        if (
          retryCount < resolvedRetryPolicy.maxRetries &&
          resolvedRetryPolicy.shouldRetry(error, retryCount)
        ) {
          const delay = resolvedRetryPolicy.retryDelay(retryCount);
          config.__retryCount = retryCount + 1;

          await new Promise((resolve) => setTimeout(resolve, delay));
          return instance.request(config);
        }
      }

      const status = error.response?.status;

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
