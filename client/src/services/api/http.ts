import axios, { type AxiosInstance } from "axios";

const http: AxiosInstance = axios.create({
  baseURL: "/api",
  timeout: 1000 * 10,
  headers: {
    "Content-Type": "application/json",
  },
});

http.interceptors.request.use(
  (config) => {
    // 添加 token
    const token = localStorage.getItem("accessToken");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

http.interceptors.response.use(
  (response) => {
    // 2xx 范围内的状态码都会触发该函数。
    // 对响应数据做点什么
    if (response.status !== 200) {
      return Promise.reject(response);
    }

    return response;
  },
  (error) => {
    // 超出 2xx 范围的状态码都会触发该函数。
    if (error.response) {
      switch (error.response.status) {
        case 401:
          localStorage.removeItem("accessToken");
          console.error("401");
          break;
        case 403:
          console.error("403");
          break;
        default:
          console.error(error.response.data.message);
          break;
      }
    }
    return Promise.reject(error);
  },
);

export default http;
