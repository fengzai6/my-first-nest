import type { AxiosRequestConfig } from "axios";

/**
 * 请求合并管理器。
 * 仅合并仍在进行中的相同请求（in-flight coalesce）。
 */
export class DedupeManager {
  private pending = new Map<string, Promise<unknown>>();
  private generateKey: (config: AxiosRequestConfig) => string;

  constructor(generateKey?: (config: AxiosRequestConfig) => string) {
    this.generateKey = generateKey ?? this.defaultGenerateKey;
  }

  /**
   * 默认的 key 生成器。
   * 由 lower-case method + baseURL + url + 稳定序列化 params 组成。
   */
  private defaultGenerateKey(config: AxiosRequestConfig): string {
    const method = (config.method ?? "get").toLowerCase();
    const baseURL = config.baseURL ?? "";
    const url = config.url ?? "";
    const sortedParams = this.stableSerialize(config.params);
    return `${method}:${baseURL}:${url}:${sortedParams}`;
  }

  private stableSerialize(value: unknown): string {
    if (value == null) {
      return "";
    }

    if (value instanceof URLSearchParams) {
      return JSON.stringify(
        Array.from(value.entries()).sort(([a], [b]) => a.localeCompare(b)),
      );
    }

    if (Array.isArray(value)) {
      return JSON.stringify(value.map((item) => this.normalizeForSerialize(item)));
    }

    if (typeof value === "object") {
      return JSON.stringify(this.normalizeForSerialize(value));
    }

    return JSON.stringify(value);
  }

  private normalizeForSerialize(value: unknown): unknown {
    if (value == null || typeof value !== "object") {
      return value;
    }

    if (Array.isArray(value)) {
      return value.map((item) => this.normalizeForSerialize(item));
    }

    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, nested]) => [key, this.normalizeForSerialize(nested)]),
    );
  }

  /**
   * 生成请求的唯一 key。
   */
  getKey(config: AxiosRequestConfig): string {
    return this.generateKey(config);
  }

  /**
   * 检查是否有正在进行的相同请求。
   * 有则返回该 Promise，无则返回 null。
   */
  getPending<T>(key: string): Promise<T> | null {
    const promise = this.pending.get(key);
    return (promise as Promise<T> | undefined) ?? null;
  }

  /**
   * 注册新的请求。
   */
  setPending<T>(key: string, promise: Promise<T>): void {
    this.pending.set(key, promise);

    // 请求完成后自动清理（使用 then 替代 finally，避免派生 Promise 未消费导致 unhandledrejection）
    const cleanup = () => {
      if (this.pending.get(key) === promise) {
        this.pending.delete(key);
      }
    };
    void promise.then(cleanup, cleanup);
  }
}
