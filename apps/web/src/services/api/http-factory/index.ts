import type { AxiosInstance, InternalAxiosRequestConfig } from "axios";
import axios, { AxiosError } from "axios";
import { REFRESH_SKIPPED, TokenRefreshManager } from "./token-refresh-manager";
import type {
  AccessTokenResult,
  ErrorContext,
  HttpClientOptions,
  RequestRetryState,
  ResolvedHttpClientOptions,
} from "./types";

const DEFAULT_MESSAGES = {
  refreshTokenExpired: "refreshToken 已失效，登录过期",
  loginExpired: "登录已失效，请重新登录",
  refreshDisabled: "未启用 refresh token 逻辑",
};

const DEFAULT_REFRESH_BUFFER_MS = 0;

const normalizeError = (error: unknown): Error => {
  if (error instanceof Error) {
    return error;
  }

  if (typeof error === "object" && error !== null && "message" in error && typeof error.message === "string") {
    return new Error(error.message);
  }

  try {
    return new Error(JSON.stringify(error));
  } catch {
    return new Error(String(error));
  }
};

const invokeOnError = async (
  error: Error,
  context: ErrorContext,
  onError?: (
    error: Error,
    context: ErrorContext,
  ) => Error | void | Promise<Error | void>,
): Promise<Error> => {
  if (!onError) {
    return error;
  }

  try {
    const result = await onError(error, context);
    return result ?? error;
  } catch {
    return error;
  }
};

const formatAccessToken = (prefix: string, token: string) => {
  const normalizedPrefix = prefix.trim();
  return normalizedPrefix ? `${normalizedPrefix} ${token}` : token;
};

const normalizeTokenResult = (result: AccessTokenResult) => {
  if (!result || typeof result === "string") {
    return { token: result ?? "", expiresAt: null };
  }

  // 验证 expiresAt 是否为有效的时间值
  const expiresAtValue = result.expiresAt;

  // 处理无效值：null、undefined、空字符串、0
  if (expiresAtValue == null || expiresAtValue === "" || expiresAtValue === 0) {
    return { token: result.token, expiresAt: null };
  }

  const expiresAtDate = new Date(expiresAtValue);

  // 检查是否为 Invalid Date
  if (Number.isNaN(expiresAtDate.getTime())) {
    return { token: result.token, expiresAt: null };
  }

  return {
    token: result.token,
    expiresAt: expiresAtDate,
  };
};

const isTokenExpiringSoon = (
  expiresAt: Date,
  refreshBufferMs: number,
): boolean => {
  return Date.now() >= expiresAt.getTime() - refreshBufferMs;
};

const shouldSkipRefresh = (
  skipRefreshUrls: string[],
  config?: InternalAxiosRequestConfig & RequestRetryState,
) => {
  const requestUrl = config?.url;

  if (!requestUrl) {
    return false;
  }

  return skipRefreshUrls.some((url) => requestUrl.includes(url));
};

const defaultIsRefreshFailure = (
  error: unknown,
  options: { unauthorizedStatusCode: number; authFailureCodes: number[] },
): boolean => {
  if (!axios.isAxiosError(error) || !error.response) {
    return false;
  }

  const status = error.response.status;
  const data = error.response.data as { code?: number } | undefined;

  if (status && status >= 500) {
    return false;
  }

  return (
    status === options.unauthorizedStatusCode ||
    (data?.code !== undefined && options.authFailureCodes.includes(data.code))
  );
};

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
        resolvedOptions.errorMessages?.loginExpired ?? DEFAULT_MESSAGES.loginExpired,
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
        const businessError =
          await resolvedOptions.onBusinessResponse(response);

        if (businessError) {
          throw businessError;
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
