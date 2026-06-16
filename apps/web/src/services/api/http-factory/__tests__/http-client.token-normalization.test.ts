import "./test-utils/mock-axios";
import { describe, expect, it, vi } from "vitest";

import type { AccessTokenResult } from "../types";
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

    // 不应该触发主动刷新
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
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(refreshAccessToken).toHaveBeenCalledTimes(1);
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
