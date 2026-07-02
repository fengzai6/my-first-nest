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
  authFailureCodes: [40103, 1001002],
  // 返回 AccessTokenDetail 时，会在 token 即将过期前主动触发刷新
  getAccessToken: () => browserTokenStore.getAccessTokenDetail(),
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
  shouldRefreshByResponseData: (response) => {
    const data = response.data as { code?: number };
    return data.code === 40101 || data.code === 1001001;
  },
  isRefreshFailure: (error) => {
    if (!(error instanceof Error) || !("response" in error)) {
      return false;
    }

    const response = error.response as
      | { status?: number; data?: { code?: number } }
      | undefined;

    if (!response || (response.status && response.status >= 500)) {
      return false;
    }

    return response.status === 401 || response.data?.code === 40103;
  },
  onBusinessResponse: (response) => {
    const data = response.data as { code?: number; message?: string };

    if (data.code !== undefined && data.code !== 0) {
      return new Error(data.message ?? "业务请求失败");
    }
  },
  onError: (error, context) => {
    console.error(`[${context.type}]`, error.message);
  },
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
