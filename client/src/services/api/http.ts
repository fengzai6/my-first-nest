import { RefreshToken } from "@/services/api/refresh-token";
import { useUserStore } from "@/stores/user";
import axios, {
  AxiosError,
  type AxiosInstance,
  type InternalAxiosRequestConfig,
} from "axios";

interface FailedRequest {
  resolve: (value: unknown) => void;
  reject: (reason?: any) => void;
}

const http: AxiosInstance = axios.create({
  baseURL: "/api",
  timeout: 1000 * 10,
  headers: {
    "Content-Type": "application/json",
  },
});

let isRefreshing: boolean = false;
let failedQueue: FailedRequest[] = [];

/**
 * 处理错误请求队列
 */
const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) {
      reject(error);
    } else {
      resolve(token);
    }
  });

  failedQueue = [];
};

http.interceptors.request.use(
  (config) => {
    const accessToken = useUserStore.getState().jwtToken?.accessToken;

    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

http.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url?.includes("/auth/refresh-token")
    ) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((accessToken) => {
            originalRequest.headers.Authorization = `Bearer ${accessToken}`;
            return http(originalRequest);
          })
          .catch((err) => {
            return Promise.reject(err);
          });
      }

      isRefreshing = true;
      originalRequest._retry = true;

      try {
        const { accessToken } = await RefreshToken();

        processQueue(null, accessToken);

        // 刷新成功，重新请求
        console.log("刷新 token 成功", accessToken);
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return http(originalRequest);
      } catch (err) {
        console.error("刷新 token 失败");

        // 刷新失败，清除用户信息
        useUserStore.getState().logout();
        processQueue(err);

        return Promise.reject(err);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);

export default http;
