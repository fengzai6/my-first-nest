import KeyvRedis from '@keyv/redis';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Cache } from 'cache-manager';

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);

  constructor(@Inject(CACHE_MANAGER) private readonly cache: Cache) {}

  /**
   * 当前缓存底层是否为 Redis。
   * 业务模块可据此切换"Redis 模式"与"无 Redis 时的回退实现"。
   */
  isRedisEnabled(): boolean {
    return this.getRedisStore() !== null;
  }

  async get<T>(key: string): Promise<T | undefined> {
    return this.cache.get<T>(key);
  }

  /**
   * @param ttlSeconds 秒；不传则使用模块默认 TTL
   */
  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<T> {
    const ttl = typeof ttlSeconds === 'number' ? ttlSeconds * 1000 : undefined;
    return this.cache.set<T>(key, value, ttl);
  }

  async del(key: string | string[]): Promise<boolean> {
    if (Array.isArray(key)) return this.cache.mdel(key);
    return this.cache.del(key);
  }

  /**
   * 命中直接返回；未命中执行 loader 后写入。
   * 注意：本期不引入分布式锁，存在惊群可能。
   */
  async wrap<T>(
    key: string,
    loader: () => Promise<T>,
    ttlSeconds?: number,
  ): Promise<T> {
    const ttl = typeof ttlSeconds === 'number' ? ttlSeconds * 1000 : undefined;
    return this.cache.wrap<T>(key, loader, ttl);
  }

  /**
   * 按 pattern 失效缓存（仅 Redis store 支持）。
   * pattern 是 Redis SCAN 的 MATCH 模式，会自动叠加 keyPrefix 命名空间。
   */
  async invalidatePattern(pattern: string): Promise<number> {
    const redisStore = this.getRedisStore();
    if (!redisStore) {
      this.logger.warn(
        `invalidatePattern 在内存 store 下不支持，已忽略 pattern=${pattern}`,
      );
      return 0;
    }

    const namespace = redisStore.namespace;
    const separator = redisStore.keyPrefixSeparator;
    const fullPattern = namespace
      ? `${namespace}${separator}${pattern}`
      : pattern;

    const client = redisStore.client as unknown as {
      scanIterator: (opts: {
        MATCH: string;
        COUNT: number;
      }) => AsyncIterable<string | string[]>;
      unlink: (keys: string[]) => Promise<number>;
      del: (keys: string[]) => Promise<number>;
    };

    let deleted = 0;
    const batch: string[] = [];
    const flush = async () => {
      if (batch.length === 0) return;
      const fn = redisStore.useUnlink ? client.unlink : client.del;
      deleted += await fn.call(client, batch.splice(0));
    };

    for await (const chunk of client.scanIterator({
      MATCH: fullPattern,
      COUNT: 200,
    })) {
      if (Array.isArray(chunk)) batch.push(...chunk);
      else batch.push(chunk);
      if (batch.length >= 500) await flush();
    }
    await flush();
    return deleted;
  }

  private getRedisStore(): KeyvRedis<unknown> | null {
    for (const keyv of this.cache.stores) {
      const store = (keyv as unknown as { store?: unknown }).store;
      if (store instanceof KeyvRedis) return store as KeyvRedis<unknown>;
    }
    return null;
  }
}
