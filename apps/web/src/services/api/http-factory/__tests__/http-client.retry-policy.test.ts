import { describe, expect, it, vi } from "vitest";
import { AxiosError } from "axios";
import {
  defaultShouldRetry,
  defaultRetryDelay,
  resolveRetryPolicy,
} from "../utils/refresh";

vi.mock("axios", async () => {
  const actual = await vi.importActual<typeof import("axios")>("axios");
  return {
    ...actual,
    default: {
      ...actual.default,
      isAxiosError: actual.default.isAxiosError,
    },
    isAxiosError: actual.isAxiosError,
  };
});

const makeAxiosError = (
  options: { status?: number; response?: boolean } = {},
): AxiosError => {
  const error = new AxiosError("test error");
  if (options.response !== false) {
    error.response = {
      status: options.status ?? 500,
      data: {},
      headers: {},
      statusText: "Error",
      config: {} as any,
    };
  }
  return error;
};

describe("defaultShouldRetry", () => {
  it("非 AxiosError（普通 Error）不重试", () => {
    expect(defaultShouldRetry(new Error("something"))).toBe(false);
  });

  it("AxiosError 无 response（网络错误）重试", () => {
    const error = makeAxiosError({ response: false });
    expect(defaultShouldRetry(error)).toBe(true);
  });

  it("AxiosError 5xx 状态码重试", () => {
    expect(defaultShouldRetry(makeAxiosError({ status: 500 }))).toBe(true);
    expect(defaultShouldRetry(makeAxiosError({ status: 502 }))).toBe(true);
    expect(defaultShouldRetry(makeAxiosError({ status: 503 }))).toBe(true);
  });

  it("AxiosError 4xx 状态码不重试", () => {
    expect(defaultShouldRetry(makeAxiosError({ status: 400 }))).toBe(false);
    expect(defaultShouldRetry(makeAxiosError({ status: 401 }))).toBe(false);
    expect(defaultShouldRetry(makeAxiosError({ status: 404 }))).toBe(false);
  });

  it("AxiosError 3xx 状态码不重试", () => {
    expect(defaultShouldRetry(makeAxiosError({ status: 301 }))).toBe(false);
  });
});

describe("defaultRetryDelay", () => {
  it("retryCount 0 → 1000ms", () => {
    expect(defaultRetryDelay(0)).toBe(1000);
  });

  it("retryCount 1 → 2000ms", () => {
    expect(defaultRetryDelay(1)).toBe(2000);
  });

  it("retryCount 2 → 4000ms（指数退避）", () => {
    expect(defaultRetryDelay(2)).toBe(4000);
  });

  it("retryCount 足够大时上限为 30000ms", () => {
    expect(defaultRetryDelay(10)).toBe(30000);
    expect(defaultRetryDelay(100)).toBe(30000);
  });
});

describe("resolveRetryPolicy", () => {
  it("未传入 retryPolicy → 返回 null", () => {
    expect(resolveRetryPolicy(undefined)).toBeNull();
  });

  it("maxRetries 未设置（默认 0）→ 返回 null", () => {
    expect(resolveRetryPolicy({})).toBeNull();
  });

  it("maxRetries 为 0 → 返回 null", () => {
    expect(resolveRetryPolicy({ maxRetries: 0 })).toBeNull();
  });

  it("maxRetries 为负数 → 返回 null", () => {
    expect(resolveRetryPolicy({ maxRetries: -1 })).toBeNull();
  });

  it("maxRetries > 0 → 返回完整策略对象", () => {
    const result = resolveRetryPolicy({ maxRetries: 2 });
    expect(result).toEqual({
      maxRetries: 2,
      shouldRetry: expect.any(Function),
      retryDelay: expect.any(Function),
    });
  });

  it("自定义 shouldRetry 和 retryDelay 会保留", () => {
    const customShouldRetry = () => true;
    const customRetryDelay = () => 500;

    const result = resolveRetryPolicy({
      maxRetries: 1,
      shouldRetry: customShouldRetry,
      retryDelay: customRetryDelay,
    });

    expect(result?.shouldRetry).toBe(customShouldRetry);
    expect(result?.retryDelay).toBe(customRetryDelay);
  });

  it("返回对象中的默认 shouldRetry 行为正确", () => {
    const policy = resolveRetryPolicy({ maxRetries: 2 });
    expect(policy?.shouldRetry(makeAxiosError({ status: 500 }), 0)).toBe(true);
    expect(policy?.shouldRetry(makeAxiosError({ status: 400 }), 0)).toBe(false);
  });

  it("返回对象中的默认 retryDelay 行为正确", () => {
    const policy = resolveRetryPolicy({ maxRetries: 2 });
    expect(policy?.retryDelay(0)).toBe(1000);
    expect(policy?.retryDelay(1)).toBe(2000);
  });
});
