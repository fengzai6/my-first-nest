import type { AxiosRequestConfig } from "axios";

interface IPendingRequest {
  promise: Promise<unknown>;
  timestamp: number;
}

/**
 * 请求合并管理器。
 * 在时间窗口内的相同请求会复用同一个 Promise。
 */
export class DedupeManager {
  private pending = new Map<string, IPendingRequest>();
  private windowMs: number;
  private generateKey: (config: AxiosRequestConfig) => string;

  constructor(
    windowMs: number = 100,
    generateKey?: (config: AxiosRequestConfig) => string,
  ) {
    this.windowMs = windowMs;
    this.generateKey = generateKey ?? this.defaultGenerateKey;
  }

  /**
   * 默认的 key 生成器。
   * 由 method + url + sorted params 组成。
   */
  private defaultGenerateKey(config: AxiosRequestConfig): string {
    const { method, url, params } = config;
    const sortedParams = params
      ? JSON.stringify(
          Object.entries(params).sort(([a], [b]) => a.localeCompare(b)),
        )
      : "";
    return `${method}:${url}:${sortedParams}`;
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
    const entry = this.pending.get(key);

    if (!entry) {
      return null;
    }

    // 检查是否过期
    if (Date.now() - entry.timestamp > this.windowMs) {
      this.pending.delete(key);
      return null;
    }

    return entry.promise as Promise<T>;
  }

  /**
   * 注册新的请求。
   */
  setPending<T>(key: string, promise: Promise<T>): void {
    this.pending.set(key, {
      promise,
      timestamp: Date.now(),
    });

    // 请求完成后自动清理（使用 then 替代 finally，避免派生 Promise 未消费导致 unhandledrejection）
    const cleanup = () => {
      const current = this.pending.get(key);
      if (current && current.promise === promise) {
        this.pending.delete(key);
      }
    };
    void promise.then(cleanup, cleanup);
  }
}
