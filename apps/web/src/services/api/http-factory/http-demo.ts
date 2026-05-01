/**
 * 示例文件：展示如何使用 createHttpClient 创建带 token 刷新的 HTTP 实例。
 * 实际项目中请根据需求调整配置，或创建独立的 client 文件。
 */
import axios from "axios";
import { createHttpClient } from "./";

const ACCESS_TOKEN_STORAGE_KEY = "APP_ACCESS_TOKEN";
const REFRESH_TOKEN_STORAGE_KEY = "APP_REFRESH_TOKEN";

export const browserTokenStore = {
  getAccessToken(): string | null {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY);
  },

  getRefreshToken(): string | null {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(REFRESH_TOKEN_STORAGE_KEY);
  },

  setAccessToken(accessToken: string) {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, accessToken);
  },

  setRefreshToken(refreshToken: string) {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, refreshToken);
  },

  clearAuth() {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
    window.localStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
  },
};

export const http = createHttpClient({
  axiosConfig: {
    baseURL: "/api",
    timeout: 15 * 1000,
  },
  authFailureCodes: [40103, 1001002],
  getAccessToken: () => browserTokenStore.getAccessToken(),
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
    };

    if (!data.accessToken) {
      throw new Error("refresh 响应缺少 accessToken");
    }

    browserTokenStore.setAccessToken(data.accessToken);

    if (data.refreshToken !== undefined) {
      browserTokenStore.setRefreshToken(data.refreshToken);
    }

    return data.accessToken;
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
