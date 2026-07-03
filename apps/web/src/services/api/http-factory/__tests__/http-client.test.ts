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
});
