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
      name: "HttpError",
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
      name: "HttpError",
      message: "unauthorized",
      status: 401,
    });

    expect(onAuthFailure).toHaveBeenCalledTimes(1);
    expect(tokenStore.getRefreshToken).not.toHaveBeenCalled();
  });

  it("非 401 的 axios 错误会被归一化为 HttpError", async () => {
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
      name: "HttpError",
      message: "server error",
      status: 500,
      data: { code: 50001, message: "server error" },
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
      name: "HttpError",
      message: "登录已失效，请重新登录",
    });

    expect(refreshAccessToken).toHaveBeenCalledTimes(1);
    expect(onAuthFailure).toHaveBeenCalledTimes(1);
  });
});
