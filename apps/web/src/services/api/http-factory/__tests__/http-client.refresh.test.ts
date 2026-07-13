import { describe, expect, it, vi } from "vitest";
import type { InternalAxiosRequestConfig } from "axios";
import { AxiosError, AxiosHeaders } from "axios";
import { shouldSkipRefresh, defaultIsRefreshFailure } from "../utils/refresh";
import type { RequestRetryState } from "../types/common";

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

const createRequestConfig = (
  config: Partial<InternalAxiosRequestConfig & RequestRetryState> = {},
): InternalAxiosRequestConfig & RequestRetryState => {
  return {
    headers: new AxiosHeaders(),
    ...config,
  } as InternalAxiosRequestConfig & RequestRetryState;
};

const makeAxiosError = (
  options: { status?: number; code?: number; response?: boolean } = {},
): AxiosError => {
  const error = new AxiosError("test error");
  if (options.response !== false) {
    error.response = {
      status: options.status ?? 401,
      data: options.code !== undefined ? { code: options.code } : {},
      headers: {},
      statusText: "Error",
      config: createRequestConfig(),
    };
  }
  return error;
};

describe("shouldSkipRefresh", () => {
  it("config 为 undefined → false", () => {
    expect(shouldSkipRefresh(["/auth"], undefined)).toBe(false);
  });

  it("config.url 为 undefined → false", () => {
    expect(shouldSkipRefresh(["/auth"], createRequestConfig())).toBe(false);
  });

  it("URL exact 命中 skipRefreshUrl → true", () => {
    expect(
      shouldSkipRefresh(["/auth/login"], createRequestConfig({ url: "/auth/login" })),
    ).toBe(true);
  });

  it("URL 以 prefix path 命中 skipRefreshUrl → true", () => {
    expect(
      shouldSkipRefresh(["/public"], createRequestConfig({ url: "/public/data" })),
    ).toBe(true);
    expect(
      shouldSkipRefresh(["/auth"], createRequestConfig({ url: "/auth/login" })),
    ).toBe(true);
  });

  it("中间段/子串路径不会跳过刷新", () => {
    expect(
      shouldSkipRefresh(["/auth"], createRequestConfig({ url: "/user/auth-history" })),
    ).toBe(false);
    expect(
      shouldSkipRefresh(["/auth"], createRequestConfig({ url: "/authorization" })),
    ).toBe(false);
    expect(
      shouldSkipRefresh(
        ["/auth"],
        createRequestConfig({ url: "/gateway/user/auth/session" }),
      ),
    ).toBe(false);
    expect(
      shouldSkipRefresh(
        ["/auth/login"],
        createRequestConfig({ url: "/api/auth/login" }),
      ),
    ).toBe(false);
  });

  it("URL 不匹配任何 skipRefreshUrl → false", () => {
    expect(
      shouldSkipRefresh(["/auth/login"], createRequestConfig({ url: "/api/profile" })),
    ).toBe(false);
  });

  it("skipRefreshUrls 为空数组 → 始终 false", () => {
    expect(
      shouldSkipRefresh([], createRequestConfig({ url: "/auth/login" })),
    ).toBe(false);
  });
});

describe("defaultIsRefreshFailure", () => {
  const baseOptions = { unauthorizedStatusCode: 401, refreshFailureCodes: [1001002] };

  it("非 AxiosError → false（编程/业务 Error 默认不视为鉴权失败）", () => {
    expect(defaultIsRefreshFailure(new Error("something"), baseOptions)).toBe(false);
    expect(defaultIsRefreshFailure(new TypeError("boom"), baseOptions)).toBe(false);
    expect(defaultIsRefreshFailure({ reason: "boom" }, baseOptions)).toBe(false);
  });

  it("AxiosError 无 response → false", () => {
    expect(
      defaultIsRefreshFailure(makeAxiosError({ response: false }), baseOptions),
    ).toBe(false);
  });

  it("status >= 500 → false（服务端错误不视为刷新失败）", () => {
    expect(defaultIsRefreshFailure(makeAxiosError({ status: 500 }), baseOptions)).toBe(false);
    expect(defaultIsRefreshFailure(makeAxiosError({ status: 502 }), baseOptions)).toBe(false);
    expect(defaultIsRefreshFailure(makeAxiosError({ status: 503 }), baseOptions)).toBe(false);
  });

  it("status 等于 unauthorizedStatusCode → true", () => {
    expect(defaultIsRefreshFailure(makeAxiosError({ status: 401 }), baseOptions)).toBe(true);
  });

  it("data.code 在 refreshFailureCodes 中 → true", () => {
    expect(
      defaultIsRefreshFailure(makeAxiosError({ status: 403, code: 1001002 }), baseOptions),
    ).toBe(true);
  });

  it("data.code 不在 refreshFailureCodes 中 → false", () => {
    expect(
      defaultIsRefreshFailure(makeAxiosError({ status: 403, code: 999999 }), baseOptions),
    ).toBe(false);
  });

  it("data.code 为 undefined 且 status 不匹配 → false", () => {
    expect(
      defaultIsRefreshFailure(makeAxiosError({ status: 403 }), baseOptions),
    ).toBe(false);
  });

  it("自定义 unauthorizedStatusCode 生效", () => {
    const options = { unauthorizedStatusCode: 498, refreshFailureCodes: [] };
    expect(defaultIsRefreshFailure(makeAxiosError({ status: 498 }), options)).toBe(true);
    expect(defaultIsRefreshFailure(makeAxiosError({ status: 401 }), options)).toBe(false);
  });
});
