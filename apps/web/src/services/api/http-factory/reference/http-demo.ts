/**
 * 示例文件：展示如何使用 createHttpClient 创建带 token 刷新的 HTTP 实例。
 * 实际项目中请根据需求调整配置，或创建独立的 client 文件。
 */
import axios from "axios";
import { createHttpClient } from "../";

const ACCESS_TOKEN_STORAGE_KEY = "APP_ACCESS_TOKEN";
const REFRESH_TOKEN_STORAGE_KEY = "APP_REFRESH_TOKEN";

const EXPIRES_AT_STORAGE_KEY = "APP_EXPIRES_AT";

export const browserTokenStore = {
  getAccessToken(): string | null {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY);
  },

  getAccessTokenDetail() {
    const token = browserTokenStore.getAccessToken();
    if (!token) return null;

    const expiresAtRaw = window.localStorage.getItem(EXPIRES_AT_STORAGE_KEY);
    const expiresAt = expiresAtRaw ? new Date(expiresAtRaw) : null;

    return {
      token,
      expiresAt: expiresAt ?? new Date(Date.now() + 15 * 60_000),
    };
  },

  getRefreshToken(): string | null {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(REFRESH_TOKEN_STORAGE_KEY);
  },

  setAccessToken(accessToken: string, expiresAt?: Date) {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, accessToken);

    if (expiresAt) {
      window.localStorage.setItem(EXPIRES_AT_STORAGE_KEY, expiresAt.toISOString());
    }
  },

  setRefreshToken(refreshToken: string) {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, refreshToken);
  },

  clearAuth() {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
    window.localStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
    window.localStorage.removeItem(EXPIRES_AT_STORAGE_KEY);
  },
};

export const http = createHttpClient({
  axiosConfig: {
    baseURL: "/api",
    timeout: 15 * 1000,
  },

  // ---- Token ----

  // 返回 AccessTokenDetail 时，会在 token 即将过期前主动触发刷新
  getAccessToken: () => browserTokenStore.getAccessTokenDetail(),

  // ---- Auth failure ----

  // refresh 请求失败时，用于识别 refresh token 失效的业务 code 列表
  refreshFailureCodes: [40103, 1001002],

  // ---- Refresh ----

  refreshAccessToken: async () => {
    const refreshToken = browserTokenStore.getRefreshToken();

    if (!refreshToken) {
      throw new Error("refreshToken 不存在");
    }

    const response = await axios.post<unknown>("/auth/refresh", {
      refreshToken,
    });

    const data = response.data as {
      accessToken?: string;
      refreshToken?: string;
      expiresAt?: string;
    };

    if (!data.accessToken) {
      throw new Error("refresh 响应缺少 accessToken");
    }

    const expiresAt = data.expiresAt
      ? new Date(data.expiresAt)
      : new Date(Date.now() + 15 * 60_000);

    browserTokenStore.setAccessToken(data.accessToken, expiresAt);

    if (data.refreshToken !== undefined) {
      browserTokenStore.setRefreshToken(data.refreshToken);
    }

    return {
      token: data.accessToken,
      expiresAt,
    };
  },

  // 通过业务响应内容判断是否需要刷新 token（如 code=40101 表示 token 过期）
  shouldRefreshByResponseData: (response) => {
    const data = response.data as { code?: number };
    return data.code === 40101 || data.code === 1001001;
  },

  // 刷新 token 后的冷却期（毫秒）。
  // 在冷却期内收到的 401 请求会跳过刷新，直接用新 token 重试。
  // 处理刷新完成后旧请求陆续返回 401 的并发场景。
  refreshCooldownMs: 15_000,

  // ---- Retry ----

  // 通用重试策略：5xx 或网络错误时重试，指数退避
  retryPolicy: {
    maxRetries: 2,
    // shouldRetry / retryDelay 可自定义，默认行为见 resolveRetryPolicy
  },

  // ---- Dedupe ----

  // 请求合并：相同 in-flight GET 请求复用同一个 Promise
  dedupePolicy: {
    enabled: true,
  },

  // ---- Runtime headers ----

  // 运行时动态 headers，每次请求时调用
  headersProvider: () => ({
    "x-request-id": crypto.randomUUID(),
  }),

  // ---- Callbacks ----

  // 业务响应拦截器：code !== 0 时视为业务失败
  onBusinessResponse: (response) => {
    const data = response.data as { code?: number; message?: string };

    if (data.code !== undefined && data.code !== 0) {
      return new Error(data.message ?? "业务请求失败");
    }
  },

  // 全局错误钩子
  onError: (error, context) => {
    console.error(`[${context.type}]`, error.message);
  },

  // 登录失效后的收尾回调
  onAuthFailure: () => {
    browserTokenStore.clearAuth();

    if (typeof window === "undefined") return;

    const loginPath = "/login";
    if (window.location.pathname !== loginPath) {
      window.location.href = loginPath;
    }
  },
});

export const getDemoProfile = async () => {
  return http.get("/account/profile");
};
