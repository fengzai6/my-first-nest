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
  getAccessToken: () => {
    return useUserStore.getState().jwtToken?.accessToken ?? null;
  },
  refreshAccessToken: async () => {
    const { accessToken } = await RefreshToken();

    return accessToken;
  },
  onAuthFailure: () => {
    useUserStore.getState().logout();
  },
  skipRefreshUrls: NO_AUTO_REFRESH_API_LIST,
});

export default newHttp;
