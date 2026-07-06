import { describe, expect, it } from "vitest";
import { formatAccessToken, normalizeTokenResult } from "../utils/token";

describe("formatAccessToken", () => {
  it("标准前缀 → 前缀 + 空格 + token", () => {
    expect(formatAccessToken("Bearer", "abc123")).toBe("Bearer abc123");
  });

  it("空前缀（空字符串）→ 仅返回 token", () => {
    expect(formatAccessToken("", "abc123")).toBe("abc123");
  });

  it("纯空格前缀（trim 后为空）→ 仅返回 token", () => {
    expect(formatAccessToken("   ", "abc123")).toBe("abc123");
  });

  it("前缀含前后空格 → trim 后拼接", () => {
    expect(formatAccessToken("  Token  ", "abc123")).toBe("Token abc123");
  });

  it("token 为空字符串 → 前缀 + 空格 + 空字符串", () => {
    expect(formatAccessToken("Bearer", "")).toBe("Bearer ");
  });
});

describe("normalizeTokenResult", () => {
  it("字符串 token → { token, expiresAt: null }", () => {
    expect(normalizeTokenResult("my-token")).toEqual({
      token: "my-token",
      expiresAt: null,
    });
  });

  it("空字符串 → { token: '', expiresAt: null }", () => {
    expect(normalizeTokenResult("")).toEqual({
      token: "",
      expiresAt: null,
    });
  });

  it("null → { token: '', expiresAt: null }", () => {
    expect(normalizeTokenResult(null as any)).toEqual({
      token: "",
      expiresAt: null,
    });
  });

  it("undefined → { token: '', expiresAt: null }", () => {
    expect(normalizeTokenResult(undefined as any)).toEqual({
      token: "",
      expiresAt: null,
    });
  });

  it("对象无 expiresAt → { token, expiresAt: null }", () => {
    expect(normalizeTokenResult({ token: "abc" } as any)).toEqual({
      token: "abc",
      expiresAt: null,
    });
  });

  it("expiresAt 为 0 → expiresAt: null", () => {
    expect(normalizeTokenResult({ token: "abc", expiresAt: 0 })).toEqual({
      token: "abc",
      expiresAt: null,
    });
  });

  it("expiresAt 为 null → expiresAt: null", () => {
    expect(
      normalizeTokenResult({ token: "abc", expiresAt: null } as any),
    ).toEqual({ token: "abc", expiresAt: null });
  });

  it("expiresAt 为 undefined → expiresAt: null", () => {
    expect(
      normalizeTokenResult({ token: "abc", expiresAt: undefined } as any),
    ).toEqual({ token: "abc", expiresAt: null });
  });

  it("expiresAt 为空字符串 → expiresAt: null", () => {
    expect(normalizeTokenResult({ token: "abc", expiresAt: "" } as any)).toEqual({
      token: "abc",
      expiresAt: null,
    });
  });

  it("expiresAt 为无效日期字符串 → expiresAt: null", () => {
    expect(
      normalizeTokenResult({ token: "abc", expiresAt: "not-a-date" }),
    ).toEqual({ token: "abc", expiresAt: null });
  });

  it("expiresAt 为有效数字时间戳 → 返回 Date 对象", () => {
    const ts = 1700000000000;
    const result = normalizeTokenResult({ token: "abc", expiresAt: ts });
    expect(result.token).toBe("abc");
    expect(result.expiresAt).toBeInstanceOf(Date);
    expect(result.expiresAt!.getTime()).toBe(ts);
  });

  it("expiresAt 为有效 ISO 字符串 → 返回 Date 对象", () => {
    const iso = "2024-11-15T00:00:00.000Z";
    const result = normalizeTokenResult({ token: "abc", expiresAt: iso });
    expect(result.token).toBe("abc");
    expect(result.expiresAt).toBeInstanceOf(Date);
    expect(result.expiresAt!.toISOString()).toBe(iso);
  });

  it("expiresAt 为 Date 对象 → 返回 Date 对象", () => {
    const date = new Date("2024-12-25T00:00:00.000Z");
    const result = normalizeTokenResult({ token: "abc", expiresAt: date as any });
    expect(result.token).toBe("abc");
    expect(result.expiresAt).toBeInstanceOf(Date);
    expect(result.expiresAt!.getTime()).toBe(date.getTime());
  });
});
