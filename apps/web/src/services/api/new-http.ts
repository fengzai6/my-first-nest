import { RefreshToken } from "@/services/api/refresh-token";
import {
  AUTH_REFRESH_SCOPE_KEY,
  tokenRefreshManager,
} from "@/services/api/token-refresh-manager";
import { useUserStore } from "@/stores/user";
import { message } from "antd";
import { createHttpClient } from "fzkit";

const NO_AUTO_REFRESH_API_LIST = ["/auth/login", "/auth/refresh-token"];

const newHttp = createHttpClient({
  axiosConfig: {
    baseURL: "/api",
    headers: {
      "Content-Type": "application/json",
    },
    timeout: 1000 * 10,
  },
  dedupePolicy: {
    enabled: true,
  },
  refreshBufferMs: import.meta.env.DEV ? 1000 * 10 : 60_000,
  refreshManager: tokenRefreshManager,
  refreshScopeKey: AUTH_REFRESH_SCOPE_KEY,
  getAccessToken: () => {
    const jwtToken = useUserStore.getState().jwtToken;
    if (!jwtToken?.accessToken) return null;

    return {
      token: jwtToken.accessToken,
      expiresAt: jwtToken.expiresAt,
    };
  },
  refreshAccessToken: async () => {
    const { accessToken, expiresAt } = await RefreshToken();

    return {
      token: accessToken,
      expiresAt,
    };
  },
  onAuthFailure: () => {
    useUserStore.getState().logout();
  },
  onError: (error) => {
    message.error(`HTTP Error: ${error.message || "请求失败"}`);
    console.error("HTTP Error:", error);
  },
  skipRefreshUrls: NO_AUTO_REFRESH_API_LIST,
  errorMessages: {
    refreshTokenExpired: "登录已过期，请重新登录",
    loginExpired: "登录已失效，请重新登录",
  },
});

export default newHttp;
