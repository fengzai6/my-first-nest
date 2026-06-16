import type {
  AxiosInstance,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from "axios";
import axios, { AxiosError } from "axios";
import { REFRESH_SKIPPED, TokenRefreshManager } from "./token-refresh-manager";
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
  unknownError: "未知错误",
  requestFailed: "请求失败",
  businessRequestFailed: "业务请求失败",
  refreshDisabled: "未启用 refresh token 逻辑",
  refreshTokenExpired: "refreshToken 已失效，登录过期",
  loginExpired: "登录已失效，请重新登录",
};

const DEFAULT_REFRESH_BUFFER_MS = 60_000;
const DEFAULT_REFRESH_COOLDOWN_MS = 15_000;

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

const normalizeHttpError = <T = unknown>(error: unknown): Error => {
  if (axios.isAxiosError<T>(error)) {
    return createHttpClientError(
      getResponseMessage(error.response, error.message),
      {
        status: error.response?.status,
        data: error.response?.data,
        response: error.response,
      },
    );
  }

  if (error instanceof Error) {
    return error;
  }

  return createHttpClientError(HTTP_CLIENT_MESSAGES.unknownError);
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
  if (
    expiresAtValue == null ||
    expiresAtValue === "" ||
    expiresAtValue === 0
  ) {
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

export const createHttpClient = <T extends AccessTokenResult = AccessTokenResult>(
  options: HttpClientOptions<T>,
): AxiosInstance => {
  const resolvedOptions: ResolvedHttpClientOptions<T> = {
    authFailureCodes: [],
    accessTokenHeaderName: "Authorization",
    accessTokenPrefix: "Bearer",
    unauthorizedStatusCode: 401,
    skipRefreshUrls: [],
    refreshBufferMs: DEFAULT_REFRESH_BUFFER_MS,
    refreshCooldownMs: DEFAULT_REFRESH_COOLDOWN_MS,
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

  const refreshManager = new TokenRefreshManager(resolvedOptions.refreshCooldownMs);
  const refreshEnabled = options.refreshAccessToken !== undefined;
  const instance = axios.create({
    timeout: 15 * 1000,
    ...resolvedOptions.axiosConfig,
  });

  const handleAuthFailure = async (error?: unknown) => {
    await resolvedOptions.onAuthFailure(error);
  };

  const refreshAccessToken = async (): Promise<AccessTokenResult | typeof REFRESH_SKIPPED> => {
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
          : normalizeHttpError(error);

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
      const refreshResult = await refreshAccessToken();

      // 如果在冷却期内跳过了刷新，重新获取 token
      if (refreshResult === REFRESH_SKIPPED) {
        const tokenResult = await resolvedOptions.getAccessToken();
        const { token } = normalizeTokenResult(tokenResult);

        config.headers = config.headers ?? {};
        config.headers[resolvedOptions.accessTokenHeaderName] = formatAccessToken(
          resolvedOptions.accessTokenPrefix,
          token,
        );

        return await instance.request(config);
      }

      // 正常刷新流程
      const { token } = normalizeTokenResult(refreshResult);

      config.headers = config.headers ?? {};
      config.headers[resolvedOptions.accessTokenHeaderName] = formatAccessToken(
        resolvedOptions.accessTokenPrefix,
        token,
      );

      return await instance.request(config);
    } catch (error) {
      throw normalizeHttpError(error);
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
      const { token, expiresAt } =
        normalizeTokenResult(tokenResult);

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

      if (!resolvedOptions.isBusinessSuccess(response)) {
        throw resolvedOptions.mapBusinessError(response);
      }

      return response;
    },
    async (error: AxiosError) => {
      const config = error.config as
        | (InternalAxiosRequestConfig & RequestRetryState)
        | undefined;

      const normalizedError = normalizeHttpError(error);

      if (!config) {
        return Promise.reject(normalizedError);
      }

      const status = error.response?.status;

      if (status === resolvedOptions.unauthorizedStatusCode) {
        if (
          !refreshEnabled ||
          shouldSkipRefresh(resolvedOptions.skipRefreshUrls, config)
        ) {
          await handleAuthFailure(normalizedError);

          return Promise.reject(normalizedError);
        }

        try {
          return await retryAfterRefresh(config);
        } catch (refreshError) {
          return Promise.reject(refreshError);
        }
      }

      return Promise.reject(normalizedError);
    },
  );

  return instance;
};
