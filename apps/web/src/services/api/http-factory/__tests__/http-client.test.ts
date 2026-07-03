import "./test-utils/mock-axios";
import axios from "axios";
import { describe, expect, it, vi } from "vitest";

import { createHttpClient } from "../";
import {
  createRefreshAccessToken,
  createTokenStore,
  queueAxiosError,
  queueCustomHandler,
  queueResponse,
} from "./test-utils/mock-axios";

describe("createHttpClient", () => {
  it("会透传 axiosConfig 给 axios.create", () => {
    const tokenStore = createTokenStore("old-access", "old-refresh");

    createHttpClient({
      axiosConfig: {
        baseURL: "/api",
        timeout: 20 * 1000,
        withCredentials: true,
        headers: {
          "X-App": "web",
        },
      },
      getAccessToken: tokenStore.getAccessToken,
    });

    expect(axios.create).toHaveBeenCalledWith({
      baseURL: "/api",
      timeout: 20 * 1000,
      withCredentials: true,
      headers: {
        "X-App": "web",
      },
    });
  });

  it("并发 401 请求只刷新一次，并在重试时使用新 token", async () => {
    const tokenStore = createTokenStore("old-access", "old-refresh");
    const refreshAccessToken = vi.fn(createRefreshAccessToken(tokenStore));

    const http = createHttpClient({
      axiosConfig: {
        baseURL: "/api",
      },
      getAccessToken: tokenStore.getAccessToken,
      refreshAccessToken,
    });

    queueAxiosError({ status: 401, data: { message: "unauthorized" } });
    queueAxiosError({ status: 401, data: { message: "unauthorized" } });
    queueResponse({
      status: 200,
      data: {
        accessToken: "new-access",
        refreshToken: "new-refresh",
      },
    });

    const retriedAuthHeaders: string[] = [];

    queueCustomHandler(async (config) => {
      retriedAuthHeaders.push(config.headers?.Authorization);
      return { status: 200, data: { ok: true }, config };
    });

    queueCustomHandler(async (config) => {
      retriedAuthHeaders.push(config.headers?.Authorization);
      return { status: 200, data: { ok: true }, config };
    });

    const [first, second] = await Promise.all([
      http.get("/profile"),
      http.get("/me"),
    ]);

    expect(first.data).toEqual({ ok: true });
    expect(second.data).toEqual({ ok: true });
    expect(refreshAccessToken).toHaveBeenCalledTimes(1);
    expect(tokenStore.getRefreshToken).toHaveBeenCalledTimes(1);
    expect(tokenStore.setAccessToken).toHaveBeenCalledTimes(1);
    expect(tokenStore.setRefreshToken).toHaveBeenCalledWith("new-refresh");
    expect(retriedAuthHeaders).toEqual([
      "Bearer new-access",
      "Bearer new-access",
    ]);
  });

  it("显式传入的鉴权 header 不会被 token 注入覆盖", async () => {
    const tokenStore = createTokenStore("old-access", "old-refresh");

    const http = createHttpClient({
      axiosConfig: {
        baseURL: "/api",
      },
      getAccessToken: tokenStore.getAccessToken,
      refreshAccessToken: createRefreshAccessToken(tokenStore),
    });

    let receivedAuthorization = "";

    queueCustomHandler(async (config) => {
      receivedAuthorization = config.headers?.Authorization;
      return { status: 200, data: { ok: true }, config };
    });

    await http.get("/profile", {
      headers: {
        Authorization: "Bearer explicit-token",
      },
    });

    expect(receivedAuthorization).toBe("Bearer explicit-token");
    expect(tokenStore.getAccessToken).not.toHaveBeenCalled();
  });

  it("getAccessToken 为空时不会注入鉴权 header", async () => {
    const getAccessToken = vi.fn(async () => "");

    const http = createHttpClient({
      axiosConfig: {
        baseURL: "/api",
      },
      getAccessToken,
    });

    let receivedAuthorization: unknown;

    queueCustomHandler(async (config) => {
      receivedAuthorization = config.headers?.Authorization;
      return { status: 200, data: { ok: true }, config };
    });

    const response = await http.get("/profile");

    expect(response.data).toEqual({ ok: true });
    expect(getAccessToken).toHaveBeenCalledTimes(1);
    expect(receivedAuthorization).toBeUndefined();
  });

  it("refresh 失败时会触发一次 onAuthFailure 并返回登录过期错误", async () => {
    const tokenStore = createTokenStore("old-access", "old-refresh");
    const onAuthFailure = vi.fn(async () => {
      tokenStore.clearAuth();
    });
    const refreshAccessToken = vi.fn(createRefreshAccessToken(tokenStore));

    const http = createHttpClient({
      axiosConfig: {
        baseURL: "/api",
      },
      getAccessToken: tokenStore.getAccessToken,
      onAuthFailure,
      refreshAccessToken,
    });

    queueAxiosError({ status: 401, data: { message: "unauthorized" } });
    queueAxiosError({ status: 401, data: { message: "refresh expired" } });

    await expect(http.get("/profile")).rejects.toMatchObject({
      name: "Error",
      message: "refreshToken 已失效，登录过期",
    });

    expect(refreshAccessToken).toHaveBeenCalledTimes(1);
    expect(tokenStore.clearAuth).toHaveBeenCalledTimes(1);
    expect(onAuthFailure).toHaveBeenCalledTimes(1);
    expect(tokenStore.setAccessToken).not.toHaveBeenCalled();
  });

  it("业务响应命中 accessToken 失效 code 时会刷新并重试", async () => {
    const tokenStore = createTokenStore("old-access", "old-refresh");

    const http = createHttpClient({
      axiosConfig: {
        baseURL: "/api",
      },
      getAccessToken: tokenStore.getAccessToken,
      refreshAccessToken: createRefreshAccessToken(tokenStore),
      shouldRefreshByResponseData: (response) => {
        const data = response.data as { code?: number };
        return data.code === 40101;
      },
    });

    queueResponse({
      status: 200,
      data: { code: 40101, message: "token expired" },
    });
    queueResponse({
      status: 200,
      data: {
        accessToken: "new-access",
        refreshToken: "new-refresh",
      },
    });

    let retriedAuthorization = "";

    queueCustomHandler(async (config) => {
      retriedAuthorization = config.headers?.Authorization;
      return { status: 200, data: { ok: true }, config };
    });

    const response = await http.get("/profile");

    expect(response.data).toEqual({ ok: true });
    expect(tokenStore.setAccessToken).toHaveBeenCalledTimes(1);
    expect(retriedAuthorization).toBe("Bearer new-access");
  });

  it("refresh 返回空字符串 refreshToken 时会交给使用者自行处理", async () => {
    const tokenStore = createTokenStore("old-access", "old-refresh");
    const refreshAccessToken = vi.fn(createRefreshAccessToken(tokenStore));

    const http = createHttpClient({
      axiosConfig: {
        baseURL: "/api",
      },
      getAccessToken: tokenStore.getAccessToken,
      refreshAccessToken,
    });

    queueAxiosError({ status: 401, data: { message: "unauthorized" } });
    queueResponse({
      status: 200,
      data: {
        accessToken: "new-access",
        refreshToken: "",
      },
    });
    queueResponse({
      status: 200,
      data: { ok: true },
    });

    const response = await http.get("/profile");

    expect(response.data).toEqual({ ok: true });
    expect(refreshAccessToken).toHaveBeenCalledTimes(1);
    expect(tokenStore.setAccessToken).toHaveBeenCalledWith("new-access");
    expect(tokenStore.setRefreshToken).toHaveBeenCalledWith("");
  });

  it("未启用刷新时，401 会触发 onAuthFailure 且不会读取 refreshToken", async () => {
    const onAuthFailure = vi.fn(async () => {});
    const tokenStore = createTokenStore("old-access", "old-refresh");

    const http = createHttpClient({
      axiosConfig: {
        baseURL: "/api",
      },
      getAccessToken: tokenStore.getAccessToken,
      onAuthFailure,
    });

    queueAxiosError({ status: 401, data: { message: "unauthorized" } });

    await expect(http.get("/profile")).rejects.toMatchObject({
      name: "Error",
      message: "Request failed",
    });

    expect(onAuthFailure).toHaveBeenCalledTimes(1);
    expect(tokenStore.getRefreshToken).not.toHaveBeenCalled();
  });

  it("非 401 的 axios 错误会透传原始错误", async () => {
    const tokenStore = createTokenStore("old-access", "old-refresh");

    const http = createHttpClient({
      axiosConfig: {
        baseURL: "/api",
      },
      getAccessToken: tokenStore.getAccessToken,
      refreshAccessToken: createRefreshAccessToken(tokenStore),
    });

    queueAxiosError({
      message: "Request failed",
      status: 500,
      data: { code: 50001, message: "server error" },
    });

    await expect(http.get("/profile")).rejects.toMatchObject({
      name: "Error",
      message: "Request failed",
    });

    expect(tokenStore.clearAuth).not.toHaveBeenCalled();
    expect(tokenStore.setAccessToken).not.toHaveBeenCalled();
  });

  it("重试后的请求再次返回 401 时会停止重试并退出登录", async () => {
    const onAuthFailure = vi.fn(async () => {});
    const tokenStore = createTokenStore("old-access", "old-refresh");
    const refreshAccessToken = vi.fn(createRefreshAccessToken(tokenStore));

    const http = createHttpClient({
      axiosConfig: {
        baseURL: "/api",
      },
      getAccessToken: tokenStore.getAccessToken,
      onAuthFailure,
      refreshAccessToken,
    });

    queueAxiosError({ status: 401, data: { message: "unauthorized" } });
    queueResponse({
      status: 200,
      data: {
        accessToken: "new-access",
      },
    });
    queueAxiosError({ status: 401, data: { message: "still unauthorized" } });

    await expect(http.get("/profile")).rejects.toMatchObject({
      name: "Error",
      message: "登录已失效，请重新登录",
    });

    expect(refreshAccessToken).toHaveBeenCalledTimes(1);
    expect(onAuthFailure).toHaveBeenCalledTimes(1);
  });

  it("多个客户端共享 TokenRefreshManager 时只刷新一次", async () => {
    const tokenStore = createTokenStore("old-access", "old-refresh");
    const refreshAccessToken = vi.fn(createRefreshAccessToken(tokenStore));
    const { TokenRefreshManager } = await import("../token-refresh-manager");
    const sharedManager = new TokenRefreshManager(15000);

    const http1 = createHttpClient({
      axiosConfig: { baseURL: "/api1" },
      getAccessToken: tokenStore.getAccessToken,
      refreshAccessToken,
      refreshManager: sharedManager,
    });

    const http2 = createHttpClient({
      axiosConfig: { baseURL: "/api2" },
      getAccessToken: tokenStore.getAccessToken,
      refreshAccessToken,
      refreshManager: sharedManager,
    });

    queueAxiosError({ status: 401, data: { message: "unauthorized" } });
    queueAxiosError({ status: 401, data: { message: "unauthorized" } });
    queueResponse({
      status: 200,
      data: { accessToken: "new-access", refreshToken: "new-refresh" },
    });
    queueCustomHandler(async (config) => ({
      status: 200,
      data: { ok: true },
      config,
    }));
    queueCustomHandler(async (config) => ({
      status: 200,
      data: { ok: true },
      config,
    }));

    const [result1, result2] = await Promise.all([
      http1.get("/profile"),
      http2.get("/users"),
    ]);

    expect(result1.data).toEqual({ ok: true });
    expect(result2.data).toEqual({ ok: true });
    expect(refreshAccessToken).toHaveBeenCalledTimes(1);
    expect(tokenStore.setAccessToken).toHaveBeenCalledTimes(1);
  });

  describe("headersProvider", () => {
    it("同步 headersProvider 注入的 headers 会合并到请求中", async () => {
      const tokenStore = createTokenStore("test-token", "test-refresh");

      const http = createHttpClient({
        axiosConfig: { baseURL: "/api" },
        getAccessToken: tokenStore.getAccessToken,
        headersProvider: () => ({
          "x-trace-id": "trace-123",
          "x-request-id": "req-456",
        }),
      });

      let receivedHeaders: Record<string, string> = {};

      queueCustomHandler(async (config) => {
        receivedHeaders = {
          "x-trace-id": config.headers?.["x-trace-id"],
          "x-request-id": config.headers?.["x-request-id"],
          Authorization: config.headers?.Authorization,
        };
        return { status: 200, data: { ok: true }, config };
      });

      await http.get("/profile");

      expect(receivedHeaders).toEqual({
        "x-trace-id": "trace-123",
        "x-request-id": "req-456",
        Authorization: "Bearer test-token",
      });
    });

    it("异步 headersProvider 注入的 headers 会合并到请求中", async () => {
      const tokenStore = createTokenStore("test-token", "test-refresh");

      const http = createHttpClient({
        axiosConfig: { baseURL: "/api" },
        getAccessToken: tokenStore.getAccessToken,
        headersProvider: async () => {
          // 模拟异步获取（如从 store 读取）
          await new Promise((resolve) => setTimeout(resolve, 10));
          return {
            "x-tenant-id": "tenant-789",
            "x-region": "cn-east",
          };
        },
      });

      let receivedHeaders: Record<string, string> = {};

      queueCustomHandler(async (config) => {
        receivedHeaders = {
          "x-tenant-id": config.headers?.["x-tenant-id"],
          "x-region": config.headers?.["x-region"],
          Authorization: config.headers?.Authorization,
        };
        return { status: 200, data: { ok: true }, config };
      });

      await http.get("/profile");

      expect(receivedHeaders).toEqual({
        "x-tenant-id": "tenant-789",
        "x-region": "cn-east",
        Authorization: "Bearer test-token",
      });
    });

    it("headersProvider 返回的 Authorization 会覆盖默认注入的 token", async () => {
      const tokenStore = createTokenStore("default-token", "test-refresh");

      const http = createHttpClient({
        axiosConfig: { baseURL: "/api" },
        getAccessToken: tokenStore.getAccessToken,
        headersProvider: () => ({
          Authorization: "Bearer custom-token",
        }),
      });

      let receivedAuthorization = "";

      queueCustomHandler(async (config) => {
        receivedAuthorization = config.headers?.Authorization;
        return { status: 200, data: { ok: true }, config };
      });

      await http.get("/profile");

      expect(receivedAuthorization).toBe("Bearer custom-token");
      // headersProvider 覆盖后，token 注入仍会执行，但最终结果以 headersProvider 为准
      expect(tokenStore.getAccessToken).toHaveBeenCalledTimes(1);
    });

    it("未配置 headersProvider 时行为不变", async () => {
      const tokenStore = createTokenStore("test-token", "test-refresh");

      const http = createHttpClient({
        axiosConfig: { baseURL: "/api" },
        getAccessToken: tokenStore.getAccessToken,
      });

      let receivedHeaders: Record<string, string> = {};

      queueCustomHandler(async (config) => {
        receivedHeaders = {
          Authorization: config.headers?.Authorization,
          "x-trace-id": config.headers?.["x-trace-id"],
        };
        return { status: 200, data: { ok: true }, config };
      });

      await http.get("/profile");

      expect(receivedHeaders).toEqual({
        Authorization: "Bearer test-token",
        "x-trace-id": undefined,
      });
    });
  });

  describe("retryPolicy", () => {
    it("5xx 错误时会重试指定次数", async () => {
      const http = createHttpClient({
        axiosConfig: { baseURL: "/api" },
        getAccessToken: async () => "",
        retryPolicy: {
          maxRetries: 2,
          retryDelay: () => 0, // 测试时不延迟
        },
      });

      // 前 2 次失败，第 3 次成功（初始 + 2 次重试）
      queueAxiosError({ status: 500, data: { message: "server error" } });
      queueAxiosError({ status: 500, data: { message: "server error" } });
      queueResponse({ status: 200, data: { ok: true } });

      const response = await http.get("/profile");

      expect(response.data).toEqual({ ok: true });
    });

    it("503 错误时会重试", async () => {
      const http = createHttpClient({
        axiosConfig: { baseURL: "/api" },
        getAccessToken: async () => "",
        retryPolicy: {
          maxRetries: 1,
          retryDelay: () => 0,
        },
      });

      queueAxiosError({ status: 503, data: { message: "service unavailable" } });
      queueResponse({ status: 200, data: { ok: true } });

      const response = await http.get("/profile");

      expect(response.data).toEqual({ ok: true });
    });

    it("超过最大重试次数后会抛出错误", async () => {
      const http = createHttpClient({
        axiosConfig: { baseURL: "/api" },
        getAccessToken: async () => "",
        retryPolicy: {
          maxRetries: 1,
          retryDelay: () => 0,
        },
      });

      // 2 次失败（初始 + 1 次重试）
      queueAxiosError({ status: 500, data: { message: "server error" } });
      queueAxiosError({ status: 500, data: { message: "server error" } });

      await expect(http.get("/profile")).rejects.toMatchObject({
        message: "Request failed",
      });
    });

    it("4xx 错误（非 401）不会重试", async () => {
      const http = createHttpClient({
        axiosConfig: { baseURL: "/api" },
        getAccessToken: async () => "",
        retryPolicy: {
          maxRetries: 2,
          retryDelay: () => 0,
        },
      });

      queueAxiosError({ status: 400, data: { message: "bad request" } });

      await expect(http.get("/profile")).rejects.toMatchObject({
        message: "Request failed",
      });
    });

    it("未配置 retryPolicy 时不会重试", async () => {
      const http = createHttpClient({
        axiosConfig: { baseURL: "/api" },
        getAccessToken: async () => "",
      });

      queueAxiosError({ status: 500, data: { message: "server error" } });

      await expect(http.get("/profile")).rejects.toMatchObject({
        message: "Request failed",
      });
    });

    it("自定义 shouldRetry 可以控制重试条件", async () => {
      const shouldRetry = vi.fn((_error, retryCount) => retryCount < 1);

      const http = createHttpClient({
        axiosConfig: { baseURL: "/api" },
        getAccessToken: async () => "",
        retryPolicy: {
          maxRetries: 3,
          shouldRetry,
          retryDelay: () => 0,
        },
      });

      queueAxiosError({ status: 500, data: { message: "server error" } });
      queueResponse({ status: 200, data: { ok: true } });

      const response = await http.get("/profile");

      expect(response.data).toEqual({ ok: true });
      expect(shouldRetry).toHaveBeenCalled();
    });
  });

  describe("dedupePolicy", () => {
    it("相同 GET 请求在时间窗口内会复用同一个 Promise", async () => {
      let requestCount = 0;

      const http = createHttpClient({
        axiosConfig: { baseURL: "/api" },
        getAccessToken: async () => "",
        dedupePolicy: {
          enabled: true,
          windowMs: 100,
        },
      });

      // 只队列一个响应，第二个请求应该复用第一个
      queueCustomHandler(async (config) => {
        requestCount++;
        return { status: 200, data: { count: requestCount }, config };
      });

      const [first, second] = await Promise.all([
        http.get("/profile"),
        http.get("/profile"),
      ]);

      // 两个请求复用同一个响应
      expect(first.data).toEqual({ count: 1 });
      expect(second.data).toEqual({ count: 1 });
      expect(requestCount).toBe(1);
    });

    it("不同 URL 的请求不会合并", async () => {
      let requestCount = 0;

      const http = createHttpClient({
        axiosConfig: { baseURL: "/api" },
        getAccessToken: async () => "",
        dedupePolicy: {
          enabled: true,
          windowMs: 100,
        },
      });

      queueCustomHandler(async (config) => {
        requestCount++;
        return { status: 200, data: { url: config.url }, config };
      });
      queueCustomHandler(async (config) => {
        requestCount++;
        return { status: 200, data: { url: config.url }, config };
      });

      const [first, second] = await Promise.all([
        http.get("/profile"),
        http.get("/settings"),
      ]);

      expect(first.data).toEqual({ url: "/profile" });
      expect(second.data).toEqual({ url: "/settings" });
      expect(requestCount).toBe(2);
    });

    it("请求级 dedupePolicy.enabled=false 可以禁用合并", async () => {
      let requestCount = 0;

      const http = createHttpClient({
        axiosConfig: { baseURL: "/api" },
        getAccessToken: async () => "",
        dedupePolicy: {
          enabled: true,
          windowMs: 100,
        },
      });

      queueCustomHandler(async (config) => {
        requestCount++;
        return { status: 200, data: { count: requestCount }, config };
      });
      queueCustomHandler(async (config) => {
        requestCount++;
        return { status: 200, data: { count: requestCount }, config };
      });

      const [first, second] = await Promise.all([
        http.get("/profile"),
        http.get("/profile", { dedupePolicy: { enabled: false } }),
      ]);

      expect(first.data).toEqual({ count: 1 });
      expect(second.data).toEqual({ count: 2 });
      expect(requestCount).toBe(2);
    });

    it("未配置 dedupePolicy 时不会合并请求", async () => {
      let requestCount = 0;

      const http = createHttpClient({
        axiosConfig: { baseURL: "/api" },
        getAccessToken: async () => "",
      });

      queueCustomHandler(async (config) => {
        requestCount++;
        return { status: 200, data: { count: requestCount }, config };
      });
      queueCustomHandler(async (config) => {
        requestCount++;
        return { status: 200, data: { count: requestCount }, config };
      });

      const [first, second] = await Promise.all([
        http.get("/profile"),
        http.get("/profile"),
      ]);

      expect(first.data).toEqual({ count: 1 });
      expect(second.data).toEqual({ count: 2 });
      expect(requestCount).toBe(2);
    });

    it("合并后的请求会传递相同的响应数据", async () => {
      const http = createHttpClient({
        axiosConfig: { baseURL: "/api" },
        getAccessToken: async () => "",
        dedupePolicy: {
          enabled: true,
          windowMs: 100,
        },
      });

      queueCustomHandler(async (config) => {
        return {
          status: 200,
          data: { id: 1, name: "test" },
          config,
        };
      });

      const [first, second] = await Promise.all([
        http.get("/profile"),
        http.get("/profile"),
      ]);

      expect(first.data).toEqual({ id: 1, name: "test" });
      expect(second.data).toEqual({ id: 1, name: "test" });
      expect(first.data).toBe(second.data);
    });

    it("POST 请求不会被合并", async () => {
      let requestCount = 0;

      const http = createHttpClient({
        axiosConfig: { baseURL: "/api" },
        getAccessToken: async () => "",
        dedupePolicy: {
          enabled: true,
          windowMs: 100,
        },
      });

      queueCustomHandler(async (config) => {
        requestCount++;
        return { status: 200, data: { count: requestCount }, config };
      });
      queueCustomHandler(async (config) => {
        requestCount++;
        return { status: 200, data: { count: requestCount }, config };
      });

      const [first, second] = await Promise.all([
        http.post("/users", { name: "test1" }),
        http.post("/users", { name: "test2" }),
      ]);

      expect(first.data).toEqual({ count: 1 });
      expect(second.data).toEqual({ count: 2 });
      expect(requestCount).toBe(2);
    });
  });
});
