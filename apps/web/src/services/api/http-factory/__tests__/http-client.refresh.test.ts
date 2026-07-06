import { describe, expect, it, vi } from "vitest";
import { AxiosError } from "axios";
import { shouldSkipRefresh, defaultIsRefreshFailure } from "../utils/refresh";

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
  options: { status?: number; code?: number; response?: boolean } = {},
): AxiosError => {
  const error = new AxiosError("test error");
  if (options.response !== false) {
    error.response = {
      status: options.status ?? 401,
      data: options.code !== undefined ? { code: options.code } : {},
      headers: {},
      statusText: "Error",
      config: {} as any,
    };
  }
  return error;
};

describe("shouldSkipRefresh", () => {
  it("config 为 undefined → false", () => {
    expect(shouldSkipRefresh(["/auth"], undefined)).toBe(false);
  });

  it("config.url 为 undefined → false", () => {
    expect(shouldSkipRefresh(["/auth"], {} as any)).toBe(false);
  });

  it("URL 包含 skipRefreshUrl → true", () => {
    expect(
      shouldSkipRefresh(["/auth/login"], { url: "/api/auth/login" } as any),
    ).toBe(true);
  });

  it("URL 不包含任何 skipRefreshUrl → false", () => {
    expect(
      shouldSkipRefresh(["/auth/login"], { url: "/api/profile" } as any),
    ).toBe(false);
  });

  it("skipRefreshUrls 为空数组 → 始终 false", () => {
    expect(
      shouldSkipRefresh([], { url: "/auth/login" } as any),
    ).toBe(false);
  });
});

describe("defaultIsRefreshFailure", () => {
  const baseOptions = { unauthorizedStatusCode: 401, authFailureCodes: [1001002] };

  it("非 AxiosError → true（业务错误视为鉴权失败）", () => {
    expect(defaultIsRefreshFailure(new Error("something"), baseOptions)).toBe(true);
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

  it("data.code 在 authFailureCodes 中 → true", () => {
    expect(
      defaultIsRefreshFailure(makeAxiosError({ status: 403, code: 1001002 }), baseOptions),
    ).toBe(true);
  });

  it("data.code 不在 authFailureCodes 中 → false", () => {
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
    const options = { unauthorizedStatusCode: 498, authFailureCodes: [] };
    expect(defaultIsRefreshFailure(makeAxiosError({ status: 498 }), options)).toBe(true);
    expect(defaultIsRefreshFailure(makeAxiosError({ status: 401 }), options)).toBe(false);
  });
});
