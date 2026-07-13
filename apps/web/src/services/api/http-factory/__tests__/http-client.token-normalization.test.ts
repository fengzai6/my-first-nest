import "./test-utils/mock-axios";
import axios from "axios";
import { describe, expect, it, vi } from "vitest";

import type { AccessTokenResult } from "../types/token";
import { createHttpClient } from "../";
import {
  queueCustomHandler,
  queueResponse,
} from "./test-utils/mock-axios";

describe("Token 规范化边界情况", () => {
  it("expiresAt 为 0 时应该返回 null，不触发主动刷新", async () => {
    const getAccessToken = vi.fn(async () => ({
      token: "valid-token",
      expiresAt: 0,
    }));

    const refreshAccessToken = vi.fn(async () => "new-token" as AccessTokenResult);

    const http = createHttpClient({
      axiosConfig: { baseURL: "/api" },
      getAccessToken,
      refreshAccessToken,
      refreshBufferMs: 60000,
    });

    queueCustomHandler(async (config) => {
      expect(config.headers?.Authorization).toBe("Bearer valid-token");
      return { status: 200, data: { ok: true } };
    });

    await http.get("/test");

    // 0 视为无效过期时间，不触发主动刷新
    expect(refreshAccessToken).not.toHaveBeenCalled();
  });

  it("expiresAt 为空字符串时应该返回 null，不触发主动刷新", async () => {
    const getAccessToken = vi.fn(async () => ({
      token: "valid-token",
      expiresAt: "",
    }));

    const refreshAccessToken = vi.fn(async () => "new-token" as AccessTokenResult);

    const http = createHttpClient({
      axiosConfig: { baseURL: "/api" },
      getAccessToken,
      refreshAccessToken,
      refreshBufferMs: 60000,
    });

    queueCustomHandler(async (config) => {
      expect(config.headers?.Authorization).toBe("Bearer valid-token");
      return { status: 200, data: { ok: true } };
    });

    await http.get("/test");

    expect(refreshAccessToken).not.toHaveBeenCalled();
  });

  it("expiresAt 为 null 时应该返回 null，不触发主动刷新", async () => {
    const getAccessToken = vi.fn(async () => ({
      token: "valid-token",
      expiresAt: null as unknown as number,
    }));

    const refreshAccessToken = vi.fn(async () => "new-token" as AccessTokenResult);

    const http = createHttpClient({
      axiosConfig: { baseURL: "/api" },
      getAccessToken,
      refreshAccessToken,
      refreshBufferMs: 60000,
    });

    queueCustomHandler(async (config) => {
      expect(config.headers?.Authorization).toBe("Bearer valid-token");
      return { status: 200, data: { ok: true } };
    });

    await http.get("/test");

    expect(refreshAccessToken).not.toHaveBeenCalled();
  });

  it("expiresAt 为 undefined 时应该返回 null，不触发主动刷新", async () => {
    const getAccessToken = vi.fn(async () => ({
      token: "valid-token",
      expiresAt: undefined as unknown as number,
    }));

    const refreshAccessToken = vi.fn(async () => "new-token" as AccessTokenResult);

    const http = createHttpClient({
      axiosConfig: { baseURL: "/api" },
      getAccessToken,
      refreshAccessToken,
      refreshBufferMs: 60000,
    });

    queueCustomHandler(async (config) => {
      expect(config.headers?.Authorization).toBe("Bearer valid-token");
      return { status: 200, data: { ok: true } };
    });

    await http.get("/test");

    expect(refreshAccessToken).not.toHaveBeenCalled();
  });

  it("expiresAt 为无效字符串时应该返回 null，不触发主动刷新", async () => {
    const getAccessToken = vi.fn(async () => ({
      token: "valid-token",
      expiresAt: "invalid-date-string",
    }));

    const refreshAccessToken = vi.fn(async () => "new-token" as AccessTokenResult);

    const http = createHttpClient({
      axiosConfig: { baseURL: "/api" },
      getAccessToken,
      refreshAccessToken,
      refreshBufferMs: 60000,
    });

    queueCustomHandler(async (config) => {
      expect(config.headers?.Authorization).toBe("Bearer valid-token");
      return { status: 200, data: { ok: true } };
    });

    await http.get("/test");

    expect(refreshAccessToken).not.toHaveBeenCalled();
  });

  it("expiresAt 为有效时间且即将过期时应该触发主动刷新", async () => {
    const futureTime = Date.now() + 30000; // 30 秒后过期
    let resolveRefresh!: () => void;
    const refreshCalled = new Promise<void>((resolve) => {
      resolveRefresh = resolve;
    });

    const getAccessToken = vi.fn(async () => ({
      token: "expiring-token",
      expiresAt: futureTime,
    }));

    const refreshAccessToken = vi.fn(async () => {
      queueResponse({
        status: 200,
        data: {
          accessToken: "refreshed-token",
          refreshToken: "new-refresh",
        },
      });
      resolveRefresh();
      return "refreshed-token" as AccessTokenResult;
    });

    const http = createHttpClient({
      axiosConfig: { baseURL: "/api" },
      getAccessToken,
      refreshAccessToken,
      refreshBufferMs: 60000, // 提前 60 秒刷新
    });

    queueCustomHandler(async (config) => {
      expect(config.headers?.Authorization).toBe("Bearer expiring-token");
      return { status: 200, data: { ok: true } };
    });

    await http.get("/test");

    // 应该异步触发主动刷新（不阻塞当前请求）
    await refreshCalled;

    expect(refreshAccessToken).toHaveBeenCalledTimes(1);
  });

  it("主动刷新网络失败时仍会触发 onError，且不阻塞当前请求", async () => {
    const futureTime = Date.now() + 30000;
    let resolveOnError!: () => void;
    const onErrorCalled = new Promise<void>((resolve) => {
      resolveOnError = resolve;
    });
    const onError = vi.fn(() => {
      resolveOnError();
    });
    const onAuthFailure = vi.fn();

    const getAccessToken = vi.fn(async () => ({
      token: "expiring-token",
      expiresAt: futureTime,
    }));

    const refreshAccessToken = vi.fn(async () => {
      const error = new axios.AxiosError("Network error");
      error.isAxiosError = true;
      throw error;
    });

    const http = createHttpClient({
      axiosConfig: { baseURL: "/api" },
      getAccessToken,
      refreshAccessToken,
      refreshBufferMs: 60000,
      onError,
      onAuthFailure,
    });

    queueCustomHandler(async (config) => {
      expect(config.headers?.Authorization).toBe("Bearer expiring-token");
      return { status: 200, data: { ok: true } };
    });

    const response = await http.get("/test");

    await onErrorCalled;

    expect(response.data).toEqual({ ok: true });
    expect(refreshAccessToken).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Network error" }),
      { type: "refresh" },
    );
    expect(onAuthFailure).not.toHaveBeenCalled();
  });

  it("主动刷新鉴权失败时会触发 onError 与 onAuthFailure，且不阻塞当前请求", async () => {
    const futureTime = Date.now() + 30000;
    let resolveOnError!: () => void;
    const onErrorCalled = new Promise<void>((resolve) => {
      resolveOnError = resolve;
    });
    const onError = vi.fn(() => {
      resolveOnError();
    });
    const onAuthFailure = vi.fn();

    const getAccessToken = vi.fn(async () => ({
      token: "expiring-token",
      expiresAt: futureTime,
    }));

    const refreshAccessToken = vi.fn(async () => {
      // 空 token 由工厂按鉴权失败处理；返回形态需与 getAccessToken 的 T 一致
      return {
        token: "",
        expiresAt: futureTime,
      };
    });

    const http = createHttpClient({
      axiosConfig: { baseURL: "/api" },
      getAccessToken,
      refreshAccessToken,
      refreshBufferMs: 60000,
      onError,
      onAuthFailure,
    });

    queueCustomHandler(async (config) => {
      expect(config.headers?.Authorization).toBe("Bearer expiring-token");
      return { status: 200, data: { ok: true } };
    });

    const response = await http.get("/test");

    await onErrorCalled;

    expect(response.data).toEqual({ ok: true });
    expect(refreshAccessToken).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Refresh token is invalid or expired",
      }),
      { type: "refresh" },
    );
    expect(onAuthFailure).toHaveBeenCalledTimes(1);
  });

  it("expiresAt 为有效时间但未过期时不应该触发主动刷新", async () => {
    const futureTime = Date.now() + 120000; // 120 秒后过期

    const getAccessToken = vi.fn(async () => ({
      token: "valid-token",
      expiresAt: futureTime,
    }));

    const refreshAccessToken = vi.fn(async () => "new-token" as AccessTokenResult);

    const http = createHttpClient({
      axiosConfig: { baseURL: "/api" },
      getAccessToken,
      refreshAccessToken,
      refreshBufferMs: 60000, // 提前 60 秒刷新
    });

    queueCustomHandler(async (config) => {
      expect(config.headers?.Authorization).toBe("Bearer valid-token");
      return { status: 200, data: { ok: true } };
    });

    await http.get("/test");

    expect(refreshAccessToken).not.toHaveBeenCalled();
  });

  it("expiresAt 为数字类型的有效时间戳应该正常工作", async () => {
    const futureTime = Date.now() + 120000;

    const getAccessToken = vi.fn(async () => ({
      token: "valid-token",
      expiresAt: futureTime, // 数字时间戳
    }));

    const refreshAccessToken = vi.fn(async () => "new-token" as AccessTokenResult);

    const http = createHttpClient({
      axiosConfig: { baseURL: "/api" },
      getAccessToken,
      refreshAccessToken,
      refreshBufferMs: 60000,
    });

    queueCustomHandler(async (config) => {
      expect(config.headers?.Authorization).toBe("Bearer valid-token");
      return { status: 200, data: { ok: true } };
    });

    await http.get("/test");

    expect(refreshAccessToken).not.toHaveBeenCalled();
  });

  it("expiresAt 为 Date 对象应该正常工作", async () => {
    const futureTime = new Date(Date.now() + 120000);

    const getAccessToken = vi.fn(async () => ({
      token: "valid-token",
      expiresAt: futureTime, // Date 对象
    }));

    const refreshAccessToken = vi.fn(async () => "new-token" as AccessTokenResult);

    const http = createHttpClient({
      axiosConfig: { baseURL: "/api" },
      getAccessToken,
      refreshAccessToken,
      refreshBufferMs: 60000,
    });

    queueCustomHandler(async (config) => {
      expect(config.headers?.Authorization).toBe("Bearer valid-token");
      return { status: 200, data: { ok: true } };
    });

    await http.get("/test");

    expect(refreshAccessToken).not.toHaveBeenCalled();
  });

  it("expiresAt 为 ISO 字符串应该正常工作", async () => {
    const futureTime = new Date(Date.now() + 120000).toISOString();

    const getAccessToken = vi.fn(async () => ({
      token: "valid-token",
      expiresAt: futureTime, // ISO 字符串
    }));

    const refreshAccessToken = vi.fn(async () => "new-token" as AccessTokenResult);

    const http = createHttpClient({
      axiosConfig: { baseURL: "/api" },
      getAccessToken,
      refreshAccessToken,
      refreshBufferMs: 60000,
    });

    queueCustomHandler(async (config) => {
      expect(config.headers?.Authorization).toBe("Bearer valid-token");
      return { status: 200, data: { ok: true } };
    });

    await http.get("/test");

    expect(refreshAccessToken).not.toHaveBeenCalled();
  });
});
