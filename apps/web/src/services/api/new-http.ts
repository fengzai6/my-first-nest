import { RefreshToken } from "@/services/api/refresh-token";
import { useUserStore } from "@/stores/user";
import { createHttpClient } from "./http-factory";

const NO_AUTO_REFRESH_API_LIST = ["/auth/login", "/auth/refresh-token"];

const newHttp = createHttpClient({
  axiosConfig: {
    baseURL: "/api",
    headers: {
      "Content-Type": "application/json",
    },
    timeout: 1000 * 10,
  },
  refreshBufferMs: import.meta.env.DEV ? 1000 * 10 : 60_000,
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
  skipRefreshUrls: NO_AUTO_REFRESH_API_LIST,
});

export default newHttp;
