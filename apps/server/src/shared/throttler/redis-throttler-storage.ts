import { Logger } from '@nestjs/common';
import type { ThrottlerStorage } from '@nestjs/throttler';
import type { RedisClientType } from '@redis/client';

/** ThrottlerStorageRecord 的返回类型（@nestjs/throttler 未导出） */
interface ThrottlerStorageRecord {
  totalHits: number;
  timeToExpire: number;
  isBlocked: boolean;
  timeToBlockExpire: number;
}

/**
 * 基于 Redis 的限流存储实现。
 *
 * 使用 Redis INCR + EXPIRE 实现固定窗口计数器：
 * - Key: throttle:{key}
 * - Value: 请求次数（整数）
 * - TTL: 窗口时长（毫秒）
 *
 * 阻塞状态使用单独的 Key：
 * - Key: throttle:block:{key}
 * - TTL: 阻塞时长（毫秒）
 */
export class RedisThrottlerStorage implements ThrottlerStorage {
  private readonly logger = new Logger(RedisThrottlerStorage.name);
  private readonly client: RedisClientType | null;

  constructor(client: RedisClientType | null) {
    this.client = client;
  }

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    // 无 Redis 时降级为不限流
    if (!this.client) {
      this.logger.warn('Redis 不可用，限流降级为不限流');
      return {
        totalHits: 0,
        timeToExpire: ttl,
        isBlocked: false,
        timeToBlockExpire: 0,
      };
    }

    const throttleKey = `throttle:${throttlerName}:${key}`;
    const blockKey = `throttle:block:${throttlerName}:${key}`;

    try {
      // 检查是否处于阻塞状态
      const blockTtl = await this.client.pTTL(blockKey);
      if (blockTtl > 0) {
        return {
          totalHits: limit + 1,
          timeToExpire: ttl,
          isBlocked: true,
          timeToBlockExpire: blockTtl,
        };
      }

      // 使用 Lua 脚本保证原子性：INCR + EXPIRE（首次设置时）
      const lua = `
      local current = redis.call("INCR", KEYS[1])
      if current == 1 then
        redis.call("PEXPIRE", KEYS[1], ARGV[1])
      end
      return current
    `;

      const totalHits = (await this.client.eval(lua, {
        keys: [throttleKey],
        arguments: [String(ttl)],
      })) as number;

      const timeToExpire = await this.client.pTTL(throttleKey);

      // 超过限制，设置阻塞
      if (totalHits > limit) {
        await this.client.set(blockKey, '1', {
          PX: blockDuration,
        });
        return {
          totalHits,
          timeToExpire,
          isBlocked: true,
          timeToBlockExpire: blockDuration,
        };
      }

      return {
        totalHits,
        timeToExpire,
        isBlocked: false,
        timeToBlockExpire: 0,
      };
    } catch (err) {
      this.logger.warn(
        `Redis 限流执行失败，限流降级为不限流: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      return {
        totalHits: 0,
        timeToExpire: ttl,
        isBlocked: false,
        timeToBlockExpire: 0,
      };
    }
  }
}
