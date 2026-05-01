import { describe, expect, it, vi } from "vitest";
import "./test-utils/mock-axios";

import { createHttpClient } from "../";
import {
  createRefreshAccessToken,
  createTokenStore,
  queueAxiosError,
  queueCustomHandler,
  queueMatchedHandler,
  queueResponse,
} from "./test-utils/mock-axios";

describe("createHttpClient edge cases", () => {
  it("命中 skipRefreshUrls 时，401 不会触发 refresh", async () => {
    const tokenStore = createTokenStore("old-access", "old-refresh");
    const onAuthFailure = vi.fn(async () => {});
    const refreshAccessToken = vi.fn(createRefreshAccessToken(tokenStore));

    const http = createHttpClient({
      axiosConfig: {
        baseURL: "/api",
      },
      getAccessToken: tokenStore.getAccessToken,
      onAuthFailure,
      refreshAccessToken,
      skipRefreshUrls: ["/auth/login"],
    });

    queueAxiosError({ status: 401, data: { message: "unauthorized" } });

    await expect(
      http.post("/auth/login", { account: "u", password: "p" }),
    ).rejects.toMatchObject({
      name: "HttpError",
      message: "Request failed",
      status: 401,
    });

    expect(refreshAccessToken).not.toHaveBeenCalled();
    expect(tokenStore.getRefreshToken).not.toHaveBeenCalled();
    expect(onAuthFailure).toHaveBeenCalledTimes(1);
  });

  it("命中 skipRefreshUrls 时，业务响应触发刷新也不会执行 refresh", async () => {
    const tokenStore = createTokenStore("old-access", "old-refresh");
    const refreshAccessToken = vi.fn(createRefreshAccessToken(tokenStore));

    const http = createHttpClient({
      axiosConfig: {
        baseURL: "/api",
      },
      getAccessToken: tokenStore.getAccessToken,
      refreshAccessToken,
      skipRefreshUrls: ["/auth/login"],
      shouldRefreshByResponseData: (response) => {
        const data = response.data as { code?: number };
        return data.code === 40101;
      },
    });

    queueResponse({
      status: 200,
      data: { code: 40101, message: "token expired" },
    });

    const response = await http.post("/auth/login", {
      account: "u",
      password: "p",
    });

    expect(response.data).toEqual({ code: 40101, message: "token expired" });
    expect(refreshAccessToken).not.toHaveBeenCalled();
    expect(tokenStore.getRefreshToken).not.toHaveBeenCalled();
  });

  it("自定义 unauthorizedStatusCode 命中时会刷新并重试", async () => {
    const tokenStore = createTokenStore("old-access", "old-refresh");
    const refreshAccessToken = vi.fn(createRefreshAccessToken(tokenStore));

    const http = createHttpClient({
      axiosConfig: {
        baseURL: "/api",
      },
      unauthorizedStatusCode: 498,
      getAccessToken: tokenStore.getAccessToken,
      refreshAccessToken,
    });

    queueAxiosError({ status: 498, data: { message: "token expired" } });
    queueResponse({
      status: 200,
      data: {
        accessToken: "new-access",
      },
    });

    let retriedAuthorization = "";

    queueCustomHandler(async (config) => {
      retriedAuthorization = config.headers?.Authorization;
      return { status: 200, data: { ok: true }, config };
    });

    const response = await http.get("/profile");

    expect(response.data).toEqual({ ok: true });
    expect(refreshAccessToken).toHaveBeenCalledTimes(1);
    expect(tokenStore.setAccessToken).toHaveBeenCalledWith("new-access");
    expect(retriedAuthorization).toBe("Bearer new-access");
  });

  it("业务响应要求刷新但未启用刷新时会直接返回原响应", async () => {
    const tokenStore = createTokenStore("old-access", "old-refresh");
    const onAuthFailure = vi.fn(async () => {});

    const http = createHttpClient({
      axiosConfig: {
        baseURL: "/api",
      },
      getAccessToken: tokenStore.getAccessToken,
      onAuthFailure,
      shouldRefreshByResponseData: () => true,
    });

    queueResponse({
      status: 200,
      data: { code: 40101, message: "token expired" },
    });

    const response = await http.get("/profile");

    expect(response.data).toEqual({ code: 40101, message: "token expired" });
    expect(onAuthFailure).not.toHaveBeenCalled();
  });

  it("refresh 成功响应缺少 accessToken 时会触发鉴权失败且不重试原请求", async () => {
    const tokenStore = createTokenStore("old-access", "old-refresh");
    const onAuthFailure = vi.fn(async () => {});
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
        refreshToken: "new-refresh",
      },
    });

    await expect(http.get("/profile")).rejects.toMatchObject({
      message: "missing accessToken",
    });

    expect(refreshAccessToken).toHaveBeenCalledTimes(1);
    expect(tokenStore.getRefreshToken).toHaveBeenCalledTimes(1);
    expect(onAuthFailure).toHaveBeenCalledTimes(1);
    expect(tokenStore.setAccessToken).not.toHaveBeenCalled();
    expect(tokenStore.setRefreshToken).not.toHaveBeenCalled();
  });

  it("并发 401 请求在 refresh 返回 500 时只触发一次 onAuthFailure", async () => {
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
    queueAxiosError({ status: 401, data: { message: "unauthorized" } });
    queueAxiosError({
      message: "refresh server error",
      status: 500,
      data: { code: 50001, message: "server error" },
    });

    const results = await Promise.allSettled([
      http.get("/profile"),
      http.get("/me"),
    ]);

    expect(results).toEqual([
      expect.objectContaining({
        status: "rejected",
        reason: expect.objectContaining({
          name: "HttpError",
          message: "refresh server error",
          status: 500,
        }),
      }),
      expect.objectContaining({
        status: "rejected",
        reason: expect.objectContaining({
          name: "HttpError",
          message: "refresh server error",
          status: 500,
        }),
      }),
    ]);
    expect(refreshAccessToken).toHaveBeenCalledTimes(1);
    expect(tokenStore.getRefreshToken).toHaveBeenCalledTimes(1);
    expect(onAuthFailure).toHaveBeenCalledTimes(1);
    expect(tokenStore.clearAuth).toHaveBeenCalledTimes(1);
    expect(tokenStore.setAccessToken).not.toHaveBeenCalled();
  });

  it("重试后的业务响应再次命中刷新条件时会停止重试并退出登录", async () => {
    const tokenStore = createTokenStore("old-access", "old-refresh");
    const onAuthFailure = vi.fn(async () => {});
    const refreshAccessToken = vi.fn(createRefreshAccessToken(tokenStore));

    const http = createHttpClient({
      axiosConfig: {
        baseURL: "/api",
      },
      getAccessToken: tokenStore.getAccessToken,
      onAuthFailure,
      refreshAccessToken,
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
    queueResponse({
      status: 200,
      data: { code: 40101, message: "still expired" },
    });

    await expect(http.get("/profile")).rejects.toMatchObject({
      name: "HttpError",
      message: "登录已失效，请重新登录",
    });

    expect(refreshAccessToken).toHaveBeenCalledTimes(1);
    expect(tokenStore.setAccessToken).toHaveBeenCalledTimes(1);
    expect(tokenStore.setRefreshToken).toHaveBeenCalledWith("new-refresh");
    expect(onAuthFailure).toHaveBeenCalledTimes(1);
  });

  it("refresh 进行中时新来的 401 请求会复用同一次 refresh", async () => {
    const tokenStore = createTokenStore("old-access", "old-refresh");
    const refreshAccessToken = vi.fn(createRefreshAccessToken(tokenStore));
    let releaseRefresh: ((value: void | PromiseLike<void>) => void) | null =
      null;

    const refreshStarted = new Promise<void>((resolve) => {
      releaseRefresh = resolve;
    });

    let notifyRefreshStarted: (() => void) | null = null;

    const waitRefreshStarted = new Promise<void>((resolve) => {
      notifyRefreshStarted = resolve;
    });

    const http = createHttpClient({
      axiosConfig: {
        baseURL: "/api",
      },
      getAccessToken: tokenStore.getAccessToken,
      refreshAccessToken,
    });

    queueMatchedHandler(
      (config) => config.url === "/profile" && !config._retry,
      async (config) => {
        const error = new Error("unauthorized") as Error & {
          config: any;
          isAxiosError: boolean;
          response?: { status?: number; data?: unknown; config: any };
        };

        error.config = config;
        error.isAxiosError = true;
        error.response = {
          status: 401,
          data: { message: "unauthorized" },
          config,
        };

        throw error;
      },
    );
    queueMatchedHandler(
      (config) => config.url === "/me" && !config._retry,
      async (config) => {
        const error = new Error("unauthorized") as Error & {
          config: any;
          isAxiosError: boolean;
          response?: { status?: number; data?: unknown; config: any };
        };

        error.config = config;
        error.isAxiosError = true;
        error.response = {
          status: 401,
          data: { message: "unauthorized" },
          config,
        };

        throw error;
      },
    );
    queueMatchedHandler(
      (config) => config.url === "/auth/refresh",
      async (config) => {
        notifyRefreshStarted?.();
        await refreshStarted;

        return {
          status: 200,
          data: {
            accessToken: "new-access",
            refreshToken: "new-refresh",
          },
          config,
        };
      },
    );

    const retriedAuthorizations: string[] = [];

    queueMatchedHandler(
      (config) => config.url === "/profile" && config._retry,
      async (config) => {
        retriedAuthorizations.push(config.headers?.Authorization);
        return { status: 200, data: { ok: "first" }, config };
      },
    );
    queueMatchedHandler(
      (config) => config.url === "/me" && config._retry,
      async (config) => {
        retriedAuthorizations.push(config.headers?.Authorization);
        return { status: 200, data: { ok: "second" }, config };
      },
    );

    const firstRequest = http.get("/profile");
    await waitRefreshStarted;
    const secondRequest = http.get("/me");
    if (releaseRefresh) {
      releaseRefresh();
    }

    const [first, second] = await Promise.all([firstRequest, secondRequest]);

    expect(first.data).toEqual({ ok: "first" });
    expect(second.data).toEqual({ ok: "second" });
    expect(refreshAccessToken).toHaveBeenCalledTimes(1);
    expect(tokenStore.getRefreshToken).toHaveBeenCalledTimes(1);
    expect(tokenStore.setAccessToken).toHaveBeenCalledTimes(1);
    expect(tokenStore.setRefreshToken).toHaveBeenCalledWith("new-refresh");
    expect(retriedAuthorizations).toEqual([
      "Bearer new-access",
      "Bearer new-access",
    ]);
  });

  it("refresh 错误命中 authFailureCodes 时会视为登录过期", async () => {
    const tokenStore = createTokenStore("old-access", "old-refresh");
    const onAuthFailure = vi.fn(async () => {});

    const http = createHttpClient({
      axiosConfig: {
        baseURL: "/api",
      },
      authFailureCodes: [1001002],
      getAccessToken: tokenStore.getAccessToken,
      onAuthFailure,
      refreshAccessToken: createRefreshAccessToken(tokenStore),
    });

    queueAxiosError({ status: 401, data: { message: "unauthorized" } });
    queueAxiosError({
      message: "refresh forbidden",
      status: 403,
      data: { code: 1001002, message: "refresh expired" },
    });

    await expect(http.get("/profile")).rejects.toMatchObject({
      name: "HttpError",
      message: "refreshToken 已失效，登录过期",
    });

    expect(onAuthFailure).toHaveBeenCalledTimes(1);
  });

  it("refresh 抛出非 Error 异常时会归一化为未知错误", async () => {
    const onAuthFailure = vi.fn(async () => {});

    const http = createHttpClient({
      axiosConfig: {
        baseURL: "/api",
      },
      getAccessToken: async () => "old-access",
      onAuthFailure,
      refreshAccessToken: async () => {
        throw { reason: "boom" };
      },
    });

    queueAxiosError({ status: 401, data: { message: "unauthorized" } });

    await expect(http.get("/profile")).rejects.toMatchObject({
      message: "未知错误",
    });

    expect(onAuthFailure).toHaveBeenCalledTimes(1);
  });

  it("onAuthFailure 抛错时会透出回调错误而不是原始鉴权错误", async () => {
    const onAuthFailure = vi.fn(async () => {
      throw new Error("cleanup failed");
    });

    const http = createHttpClient({
      axiosConfig: {
        baseURL: "/api",
      },
      getAccessToken: async () => "old-access",
      onAuthFailure,
    });

    queueAxiosError({ status: 401, data: { message: "unauthorized" } });

    await expect(http.get("/profile")).rejects.toMatchObject({
      message: "cleanup failed",
    });

    expect(onAuthFailure).toHaveBeenCalledTimes(1);
    expect(onAuthFailure).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "HttpError",
        message: "Request failed",
        status: 401,
      }),
    );
  });
});
