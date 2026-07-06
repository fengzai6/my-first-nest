import "./test-utils/mock-axios";
import axios from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createHttpClient } from "../";
import {
  createRefreshAccessToken,
  createTokenStore,
  queueAxiosError,
  queueCustomHandler,
  queueResponse,
} from "./test-utils/mock-axios";

describe("Token 刷新冷却期机制", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("场景 3：刷新完成后，旧请求陆续返回 401 → 跳过刷新，用新 Token 重试", async () => {
    const tokenStore = createTokenStore("old-access", "old-refresh");
    const refreshAccessToken = vi.fn(createRefreshAccessToken(tokenStore));

    const http = createHttpClient({
      axiosConfig: { baseURL: "/api" },
      getAccessToken: tokenStore.getAccessToken,
      refreshAccessToken,
      refreshCooldownMs: 15000,
    });

    // 第一个请求 401，触发刷新
    queueAxiosError({ status: 401, data: { message: "unauthorized" } });
    queueResponse({
      status: 200,
      data: { accessToken: "new-access", refreshToken: "new-refresh" },
    });
    queueCustomHandler(async (config) => ({
      status: 200,
      data: { result: "first-retry" },
      config,
    }));

    const firstRequest = http.get("/profile");

    // 等待第一个请求完成刷新
    await vi.runAllTimersAsync();
    await firstRequest;

    // 刷新完成后 5 秒，旧请求返回 401
    await vi.advanceTimersByTimeAsync(5000);

    queueAxiosError({ status: 401, data: { message: "unauthorized" } });
    queueCustomHandler(async (config) => {
      // 应该使用新 token 重试，不会再次刷新
      expect(config.headers?.Authorization).toBe("Bearer new-access");
      return { status: 200, data: { result: "second-retry" }, config };
    });

    const secondRequest = await http.get("/me");

    expect(secondRequest.data).toEqual({ result: "second-retry" });
    expect(refreshAccessToken).toHaveBeenCalledTimes(1); // 只刷新了一次
  });

  it("场景 4：慢请求卡了 10 秒后返回 401 → 跳过刷新（在 15 秒冷却期内）", async () => {
    const tokenStore = createTokenStore("old-access", "old-refresh");
    const refreshAccessToken = vi.fn(createRefreshAccessToken(tokenStore));

    const http = createHttpClient({
      axiosConfig: { baseURL: "/api" },
      getAccessToken: tokenStore.getAccessToken,
      refreshAccessToken,
      refreshCooldownMs: 15000,
    });

    // 第一个请求触发刷新
    queueAxiosError({ status: 401 });
    queueResponse({
      status: 200,
      data: { accessToken: "new-access", refreshToken: "new-refresh" },
    });
    queueCustomHandler(async () => ({
      status: 200,
      data: { result: "first" },
    }));

    await http.get("/fast");

    // 10 秒后，慢请求返回 401
    await vi.advanceTimersByTimeAsync(10000);

    queueAxiosError({ status: 401 });
    queueCustomHandler(async (config) => {
      expect(config.headers?.Authorization).toBe("Bearer new-access");
      return { status: 200, data: { result: "slow-retry" } };
    });

    const slowResponse = await http.get("/slow");

    expect(slowResponse.data).toEqual({ result: "slow-retry" });
    expect(refreshAccessToken).toHaveBeenCalledTimes(1);
  });

  it("场景 5：冷却期过后（16 秒）又收到 401 → 正常执行刷新", async () => {
    const tokenStore = createTokenStore("old-access", "old-refresh");
    const refreshAccessToken = vi.fn(createRefreshAccessToken(tokenStore));

    const http = createHttpClient({
      axiosConfig: { baseURL: "/api" },
      getAccessToken: tokenStore.getAccessToken,
      refreshAccessToken,
      refreshCooldownMs: 15000,
    });

    // 第一次刷新
    queueAxiosError({ status: 401 });
    queueResponse({
      status: 200,
      data: { accessToken: "token-1", refreshToken: "refresh-1" },
    });
    queueCustomHandler(async () => ({ status: 200, data: { ok: true } }));

    await http.get("/first");

    // 16 秒后，冷却期已过
    await vi.advanceTimersByTimeAsync(16000);

    // 再次 401，应该触发第二次刷新
    queueAxiosError({ status: 401 });
    queueResponse({
      status: 200,
      data: { accessToken: "token-2", refreshToken: "refresh-2" },
    });
    queueCustomHandler(async (config) => {
      expect(config.headers?.Authorization).toBe("Bearer token-2");
      return { status: 200, data: { result: "second" } };
    });

    const secondResponse = await http.get("/second");

    expect(secondResponse.data).toEqual({ result: "second" });
    expect(refreshAccessToken).toHaveBeenCalledTimes(2);
  });

  it("场景 6：刷新失败后重试 → 下次可以重新刷新", async () => {
    const tokenStore = createTokenStore("old-access", "old-refresh");
    let refreshAttempts = 0;

    const refreshAccessToken = vi.fn(async () => {
      refreshAttempts++;

      // 第一次刷新失败（模拟网络错误：AxiosError 无 response）
      if (refreshAttempts === 1) {
        const error = new axios.AxiosError("Network error");
        error.isAxiosError = true;
        throw error;
      }

      // 第二次刷新成功
      const response = await axios.post("/auth/refresh", {
        refreshToken: await tokenStore.getRefreshToken(),
      });
      const data = response.data as {
        accessToken: string;
        refreshToken: string;
      };

      tokenStore.setAccessToken(data.accessToken);
      tokenStore.setRefreshToken(data.refreshToken);

      return data.accessToken;
    });

    const http = createHttpClient({
      axiosConfig: { baseURL: "/api" },
      getAccessToken: tokenStore.getAccessToken,
      refreshAccessToken,
      refreshCooldownMs: 15000,
    });

    // 第一次刷新失败
    queueAxiosError({ status: 401 });

    await expect(http.get("/first")).rejects.toThrow("Network error");

    // 第二次刷新成功
    queueAxiosError({ status: 401 });
    queueResponse({
      status: 200,
      data: { accessToken: "new-token", refreshToken: "new-refresh" },
    });
    queueCustomHandler(async () => ({ status: 200, data: { ok: true } }));

    const secondResponse = await http.get("/second");

    expect(secondResponse.data).toEqual({ ok: true });
    expect(refreshAccessToken).toHaveBeenCalledTimes(2);
  });

  it("场景 7：skipRefreshUrls 不触发刷新逻辑", async () => {
    const tokenStore = createTokenStore("old-access", "old-refresh");
    const refreshAccessToken = vi.fn(createRefreshAccessToken(tokenStore));
    const onAuthFailure = vi.fn();

    const http = createHttpClient({
      axiosConfig: { baseURL: "/api" },
      getAccessToken: tokenStore.getAccessToken,
      refreshAccessToken,
      skipRefreshUrls: ["/public"],
      onAuthFailure,
      refreshCooldownMs: 15000,
    });

    queueAxiosError({ status: 401, data: { message: "unauthorized" } });

    await expect(http.get("/public/data")).rejects.toThrow();

    expect(refreshAccessToken).not.toHaveBeenCalled();
    expect(onAuthFailure).toHaveBeenCalledTimes(1);
  });

  it("场景 8：冷却期边界测试（14.9 秒 vs 15.1 秒）", async () => {
    const tokenStore = createTokenStore("old-access", "old-refresh");
    const refreshAccessToken = vi.fn(createRefreshAccessToken(tokenStore));

    const http = createHttpClient({
      axiosConfig: { baseURL: "/api" },
      getAccessToken: tokenStore.getAccessToken,
      refreshAccessToken,
      refreshCooldownMs: 15000,
    });

    // 第一次刷新
    queueAxiosError({ status: 401 });
    queueResponse({
      status: 200,
      data: { accessToken: "token-1", refreshToken: "refresh-1" },
    });
    queueCustomHandler(async () => ({ status: 200, data: { ok: true } }));

    await http.get("/first");

    // 14.9 秒后，仍在冷却期内
    await vi.advanceTimersByTimeAsync(14900);

    queueAxiosError({ status: 401 });
    queueCustomHandler(async (config) => {
      expect(config.headers?.Authorization).toBe("Bearer token-1");
      return { status: 200, data: { result: "within-cooldown" } };
    });

    await http.get("/within");

    expect(refreshAccessToken).toHaveBeenCalledTimes(1);

    // 再过 300ms，总共 15.2 秒，冷却期已过
    await vi.advanceTimersByTimeAsync(300);

    queueAxiosError({ status: 401 });
    queueResponse({
      status: 200,
      data: { accessToken: "token-2", refreshToken: "refresh-2" },
    });
    queueCustomHandler(async (config) => {
      expect(config.headers?.Authorization).toBe("Bearer token-2");
      return { status: 200, data: { result: "after-cooldown" } };
    });

    await http.get("/after");

    expect(refreshAccessToken).toHaveBeenCalledTimes(2);
  });
});
