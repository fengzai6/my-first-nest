import type { AxiosInstance, InternalAxiosRequestConfig } from "axios";
import axios, { AxiosError, AxiosHeaders } from "axios";
import { DEFAULT_MESSAGES, DEFAULT_REFRESH_BUFFER_MS } from "./constants";
import { DedupeManager } from "./dedupe-manager";
import { REFRESH_SKIPPED, TokenRefreshManager } from "./token-refresh-manager";
import type { ErrorContext, RequestRetryState } from "./types/common";
import type {
  HttpClientOptions,
  ResolvedHttpClientOptions,
} from "./types/http-client-options";
import type { AccessTokenResult } from "./types/token";
import { invokeOnError, normalizeError } from "./utils/error";
import {
  defaultIsRefreshFailure,
  resolveRetryPolicy,
  shouldSkipRefresh,
} from "./utils/refresh";
import {
  formatAccessToken,
  isTokenExpiringSoon,
  normalizeTokenResult,
} from "./utils/token";

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
  // 始终准备 manager：客户端默认关闭时，仍允许请求级 { enabled: true } 临时启用
  // 请求级仅可覆盖 enabled，generateKey 只读取客户端级配置
  const clientDedupePolicy = options.dedupePolicy;
  const clientDedupeEnabled = clientDedupePolicy?.enabled === true;
  const dedupeManager = new DedupeManager(clientDedupePolicy?.generateKey);

  const instance = axios.create({
    timeout: 15 * 1000,
    ...resolvedOptions.axiosConfig,
  });

  // 包装 request 方法，实现请求合并（仅 GET）
  // 内部 refresh / retry 通过 replayRequest(=originalRequest) 旁路 dedupe，
  // 避免 pending 自引用死锁，也不污染业务 config
  const originalRequest = instance.request.bind(instance);
  const replayRequest = (
    config: InternalAxiosRequestConfig & RequestRetryState,
  ) => originalRequest(config);

  const handleAuthFailure = async (error?: unknown) => {
    await resolvedOptions.onAuthFailure?.(error);
  };

  const rejectWithError = async (
    error: unknown,
    type: ErrorContext["type"],
  ) => {
    const normalized = normalizeError(error);
    const finalError = await invokeOnError(
      normalized,
      { type },
      resolvedOptions.onError,
    );
    return Promise.reject(finalError);
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

    const headers = AxiosHeaders.from(config.headers ?? {});
    headers.set(
      resolvedOptions.accessTokenHeaderName,
      formatAccessToken(resolvedOptions.accessTokenPrefix, token),
    );
    config.headers = headers;
    // 重试需要重新跑 headersProvider / 请求准备逻辑
    config.__headersPrepared = false;

    // 内部重试旁路 dedupe：不经过 instance.request 包装
    return replayRequest(config);
  };

  const prepareRequestHeaders = async (
    config: InternalAxiosRequestConfig & RequestRetryState,
  ) => {
    if (config.__headersPrepared) {
      return config;
    }

    const headersProvider = resolvedOptions.headersProvider;
    const runtimeHeaders = headersProvider
      ? await headersProvider()
      : undefined;

    // 先合并调用方 / headersProvider 的 headers，再做大小写无关的 token 判定
    const headers = AxiosHeaders.from(config.headers ?? {});
    if (runtimeHeaders) {
      headers.set(runtimeHeaders);
    }
    config.headers = headers;

    const currentAuthorization = headers.get(
      resolvedOptions.accessTokenHeaderName,
    );

    // 仅在调用方未显式提供 header（undefined/null）时注入 token
    // 空字符串也视为显式控制，不覆盖
    const needToken = currentAuthorization == null;

    if (needToken) {
      const tokenResult = await resolvedOptions.getAccessToken();
      const { token, expiresAt } = normalizeTokenResult(tokenResult);

      if (token !== "") {
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

        headers.set(
          resolvedOptions.accessTokenHeaderName,
          formatAccessToken(resolvedOptions.accessTokenPrefix, token),
        );
      }
    }

    config.__headersPrepared = true;
    return config;
  };

  // 请求级仅可覆盖 enabled；generateKey 固定使用客户端级配置
  instance.request = ((
    config: InternalAxiosRequestConfig & RequestRetryState,
  ) => {
    const method = (config.method ?? "get").toLowerCase();
    if (method !== "get") {
      return originalRequest(config);
    }

    const requestDedupePolicy = config.dedupePolicy;
    const shouldDedupe = requestDedupePolicy?.enabled ?? clientDedupeEnabled;

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

  instance.interceptors.request.use(
    async (config: InternalAxiosRequestConfig & RequestRetryState) => {
      return prepareRequestHeaders(config);
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
        return rejectWithError(normalizedError, "request");
      }

      const status = error.response?.status;

      // 鉴权失败优先于通用重试，避免 401 被 shouldRetry 空耗重试次数
      if (status === resolvedOptions.unauthorizedStatusCode) {
        if (
          !refreshEnabled ||
          shouldSkipRefresh(resolvedOptions.skipRefreshUrls, config)
        ) {
          await handleAuthFailure(normalizedError);
          return rejectWithError(normalizedError, "request");
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
          // 内部重试旁路 dedupe：不经过 instance.request 包装
          return replayRequest(config);
        }
      }

      return rejectWithError(normalizedError, "request");
    },
  );

  return instance;
};
