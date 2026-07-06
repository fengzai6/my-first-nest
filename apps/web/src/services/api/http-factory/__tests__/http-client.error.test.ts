import { describe, expect, it, vi } from "vitest";
import { normalizeError, invokeOnError } from "../utils/error";

describe("normalizeError", () => {
  it("Error 实例直接返回", () => {
    const error = new Error("test");
    expect(normalizeError(error)).toBe(error);
  });

  it("具有 message 属性的对象 → 构造 Error", () => {
    const result = normalizeError({ message: "from object" });
    expect(result).toBeInstanceOf(Error);
    expect(result.message).toBe("from object");
  });

  it("可序列化值 → JSON.stringify 结果作为 message", () => {
    expect(normalizeError({ code: 1 }).message).toBe('{"code":1}');
    expect(normalizeError("string error").message).toBe('"string error"');
    expect(normalizeError(42).message).toBe("42");
    expect(normalizeError(null).message).toBe("null");
    expect(normalizeError(undefined).message).toBe("");
  });

  it("循环引用对象 → String(error) 作为降级", () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;

    const result = normalizeError(circular);
    expect(result).toBeInstanceOf(Error);
    expect(result.message).toBe("[object Object]");
  });
});

describe("invokeOnError", () => {
  const baseError = new Error("original");

  it("未传 onError → 返回原 error", async () => {
    const result = await invokeOnError(baseError, { type: "request" });
    expect(result).toBe(baseError);
  });

  it("onError 返回 void → 返回原 error", async () => {
    const onError = vi.fn(() => {});
    const result = await invokeOnError(baseError, { type: "request" }, onError);
    expect(result).toBe(baseError);
    expect(onError).toHaveBeenCalledWith(baseError, { type: "request" });
  });

  it("onError 返回新 Error → 替换原 error", async () => {
    const replacement = new Error("replaced");
    const onError = vi.fn(() => replacement);
    const result = await invokeOnError(baseError, { type: "refresh" }, onError);
    expect(result).toBe(replacement);
  });

  it("onError 抛错 → 返回原 error（降级）", async () => {
    const onError = vi.fn(() => {
      throw new Error("callback failed");
    });
    const result = await invokeOnError(baseError, { type: "request" }, onError);
    expect(result).toBe(baseError);
  });

  it("onError 异步返回新 Error → 替换原 error", async () => {
    const replacement = new Error("async replaced");
    const onError = vi.fn(async () => replacement);
    const result = await invokeOnError(baseError, { type: "request" }, onError);
    expect(result).toBe(replacement);
  });

  it("onError 异步抛错 → 返回原 error（降级）", async () => {
    const onError = vi.fn(async () => {
      throw new Error("async callback failed");
    });
    const result = await invokeOnError(baseError, { type: "request" }, onError);
    expect(result).toBe(baseError);
  });

  it("onError 返回 undefined → 等同于 void，返回原 error", async () => {
    const onError = vi.fn(() => undefined);
    const result = await invokeOnError(baseError, { type: "request" }, onError);
    expect(result).toBe(baseError);
  });

  it("context 透传 request 类型", async () => {
    const onError = vi.fn(() => {});
    await invokeOnError(baseError, { type: "request" }, onError);
    expect(onError).toHaveBeenCalledWith(baseError, { type: "request" });
  });

  it("context 透传 refresh 类型", async () => {
    const onError = vi.fn(() => {});
    await invokeOnError(baseError, { type: "refresh" }, onError);
    expect(onError).toHaveBeenCalledWith(baseError, { type: "refresh" });
  });
});
