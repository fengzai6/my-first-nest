import KeyvRedis from '@keyv/redis';
import { withTimeout } from '@/shared/utils/promise';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Cache } from 'cache-manager';

const PING_TIMEOUT_MS = 1000;

@Injectable()
export class CacheHealthIndicator {
  private readonly logger = new Logger(CacheHealthIndicator.name);

  constructor(@Inject(CACHE_MANAGER) private readonly cache: Cache) {}

  /**
   * 轻量探测：对底层 Redis 客户端发起一次 PING；
   * 若当前为内存 store 则视为健康。
   */
  async ping(): Promise<boolean> {
    const redisStore = this.getRedisStore();
    if (!redisStore) return true;

    const client = redisStore.client as unknown as {
      ping: () => Promise<string>;
      isOpen?: boolean;
      connect?: () => Promise<unknown>;
    };

    try {
      if (client.isOpen === false && typeof client.connect === 'function') {
        await withTimeout(
          client.connect(),
          PING_TIMEOUT_MS,
          'Redis CONNECT timeout',
        );
      }

      const result = await withTimeout(
        client.ping(),
        PING_TIMEOUT_MS,
        'Redis PING timeout',
      );

      return result === 'PONG';
    } catch (err) {
      this.logger.warn(
        `Redis PING 失败: ${err instanceof Error ? err.message : String(err)}`,
      );
      return false;
    }
  }

  private getRedisStore(): KeyvRedis<unknown> | null {
    for (const keyv of this.cache.stores) {
      const store = (keyv as unknown as { store?: unknown }).store;
      if (store instanceof KeyvRedis) return store as KeyvRedis<unknown>;
    }
    return null;
  }
}
