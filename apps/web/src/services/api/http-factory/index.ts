import type { AxiosInstance, InternalAxiosRequestConfig } from "axios";
import axios, { AxiosError } from "axios";
import { REFRESH_SKIPPED, TokenRefreshManager } from "./token-refresh-manager";
import type {
  AccessTokenResult,
  HttpClientOptions,
  RequestRetryState,
  ResolvedHttpClientOptions,
} from "./types";
import {
  DEFAULT_MESSAGES,
  DEFAULT_REFRESH_BUFFER_MS,
  formatAccessToken,
  normalizeError,
  normalizeTokenResult,
  isTokenExpiringSoon,
  invokeOnError,
  shouldSkipRefresh,
  defaultIsRefreshFailure,
} from "./utils";

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
  const instance = axios.create({
    timeout: 15 * 1000,
    ...resolvedOptions.axiosConfig,
  });

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
        const authError = resolvedOptions.isRefreshFailure(error)
          ? new Error(
              resolvedOptions.errorMessages?.refreshTokenExpired ??
                DEFAULT_MESSAGES.refreshTokenExpired,
            )
          : normalizedError;

        await handleAuthFailure(authError);
        throw await invokeOnError(
          authError,
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

        // 返回了新响应
        if (businessResult && "request" in businessResult) {
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
