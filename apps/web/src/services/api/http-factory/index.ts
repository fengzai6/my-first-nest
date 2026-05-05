import type {
  AxiosInstance,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from "axios";
import axios, { AxiosError } from "axios";
import { TokenRefreshManager } from "./token-refresh-manager";
import type {
  AccessTokenResult,
  HttpClientOptions,
  RequestRetryState,
  ResolvedHttpClientOptions,
} from "./types";

type HttpClientError<T = unknown> = Error & {
  status?: number;
  data?: T;
  response?: AxiosResponse<T>;
};

const HTTP_CLIENT_MESSAGES = {
  requestFailed: "请求失败",
  businessRequestFailed: "业务请求失败",
  refreshDisabled: "未启用 refresh token 逻辑",
  refreshTokenExpired: "refreshToken 已失效，登录过期",
  loginExpired: "登录已失效，请重新登录",
};

const DEFAULT_REFRESH_BUFFER_MS = 60_000;

const createHttpClientError = <T = unknown>(
  message: string,
  options?: {
    status?: number;
    data?: T;
    response?: AxiosResponse<T>;
  },
): HttpClientError<T> => {
  const error = new Error(message) as HttpClientError<T>;

  error.name = "HttpError";
  error.status = options?.status;
  error.data = options?.data;
  error.response = options?.response;

  return error;
};

const getResponseMessage = (
  response?: AxiosResponse<unknown>,
  fallbackMessage = HTTP_CLIENT_MESSAGES.requestFailed,
) => {
  const responseMessage =
    response?.data &&
    typeof response.data === "object" &&
    "message" in response.data
      ? response.data.message
      : undefined;

  if (typeof responseMessage === "string" && responseMessage.trim()) {
    return responseMessage;
  }

  return fallbackMessage;
};

const overrideErrorMessage = <T>(error: T): T => {
  if (!axios.isAxiosError(error) || !error.response) {
    return error;
  }

  error.message = getResponseMessage(error.response, error.message);

  return error;
};

const formatAccessToken = (prefix: string, token: string) => {
  const normalizedPrefix = prefix.trim();
  return normalizedPrefix ? `${normalizedPrefix} ${token}` : token;
};

const normalizeTokenResult = (result: AccessTokenResult) => {
  if (!result || typeof result === "string") {
    return { token: result ?? "", expiresAt: null, refreshBufferMs: undefined };
  }

  return {
    token: result.token,
    expiresAt: new Date(result.expiresAt),
    refreshBufferMs: result.refreshBufferMs,
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

export const createHttpClient = (options: HttpClientOptions): AxiosInstance => {
  const refreshManager = new TokenRefreshManager();
  const refreshEnabled = options.refreshAccessToken !== undefined;

  const resolvedOptions: ResolvedHttpClientOptions = {
    authFailureCodes: [],
    accessTokenHeaderName: "Authorization",
    accessTokenPrefix: "Bearer",
    unauthorizedStatusCode: 401,
    skipRefreshUrls: [],
    isBusinessSuccess: () => true,
    mapBusinessError: (response: AxiosResponse<unknown>) => {
      return createHttpClientError(
        getResponseMessage(
          response,
          HTTP_CLIENT_MESSAGES.businessRequestFailed,
        ),
        {
          status: response.status,
          data: response.data,
          response,
        },
      );
    },
    shouldRefreshByResponseData: () => false,
    onAuthFailure: () => {},
    isRefreshFailure: (error: unknown) => {
      if (!axios.isAxiosError(error) || !error.response) {
        return false;
      }

      const status = error.response.status;
      const data = error.response.data as { code?: number } | undefined;

      if (status && status >= 500) {
        return false;
      }

      return (
        status === resolvedOptions.unauthorizedStatusCode ||
        (data?.code !== undefined &&
          resolvedOptions.authFailureCodes.includes(data.code))
      );
    },
    ...options,
  };
  const instance = axios.create({
    timeout: 15 * 1000,
    ...resolvedOptions.axiosConfig,
  });

  const handleAuthFailure = async (error?: unknown) => {
    await resolvedOptions.onAuthFailure(error);
  };

  const refreshAccessToken = async (): Promise<string> => {
    const requestRefreshAccessToken = resolvedOptions.refreshAccessToken;

    if (!refreshEnabled || !requestRefreshAccessToken) {
      throw new Error(HTTP_CLIENT_MESSAGES.refreshDisabled);
    }

    return refreshManager.runRefresh(async () => {
      try {
        return await requestRefreshAccessToken();
      } catch (error) {
        const authError = resolvedOptions.isRefreshFailure(error)
          ? createHttpClientError(HTTP_CLIENT_MESSAGES.refreshTokenExpired)
          : overrideErrorMessage(error);

        await handleAuthFailure(authError);
        throw authError;
      }
    });
  };

  const retryAfterRefresh = async (
    config: InternalAxiosRequestConfig & RequestRetryState,
  ) => {
    if (config._retry) {
      const authError = createHttpClientError(
        HTTP_CLIENT_MESSAGES.loginExpired,
      );
      await handleAuthFailure(authError);
      throw authError;
    }

    config._retry = true;

    try {
      const newAccessToken = await refreshAccessToken();

      config.headers = config.headers ?? {};
      config.headers[resolvedOptions.accessTokenHeaderName] = formatAccessToken(
        resolvedOptions.accessTokenPrefix,
        newAccessToken,
      );

      return await instance.request(config);
    } catch (error) {
      throw overrideErrorMessage(error);
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
      const { token, expiresAt, refreshBufferMs } =
        normalizeTokenResult(tokenResult);

      if (!token) return config;

      // 主动刷新：token 即将过期时异步触发刷新，不阻塞当前请求
      if (
        refreshEnabled &&
        expiresAt &&
        !shouldSkipRefresh(resolvedOptions.skipRefreshUrls, config)
      ) {
        const bufferMs = refreshBufferMs ?? DEFAULT_REFRESH_BUFFER_MS;

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

      if (resolvedOptions.shouldRefreshByResponseData(response)) {
        if (
          !refreshEnabled ||
          shouldSkipRefresh(resolvedOptions.skipRefreshUrls, config)
        ) {
          return response;
        }

        return retryAfterRefresh(config);
      }

      if (!resolvedOptions.isBusinessSuccess(response)) {
        throw resolvedOptions.mapBusinessError(response);
      }

      return response;
    },
    async (error: AxiosError) => {
      const config = error.config as
        | (InternalAxiosRequestConfig & RequestRetryState)
        | undefined;

      overrideErrorMessage(error);

      if (!config) {
        return Promise.reject(error);
      }

      const status = error.response?.status;

      if (status === resolvedOptions.unauthorizedStatusCode) {
        if (
          !refreshEnabled ||
          shouldSkipRefresh(resolvedOptions.skipRefreshUrls, config)
        ) {
          await handleAuthFailure(error);

          return Promise.reject(error);
        }

        try {
          return await retryAfterRefresh(config);
        } catch (refreshError) {
          return Promise.reject(refreshError);
        }
      }

      return Promise.reject(error);
    },
  );

  return instance;
};
