import { Inject, Injectable } from '@nestjs/common';
import type { RedisClientType } from '@redis/client';
import { REDIS_CLIENT } from './cache.module';

@Injectable()
export class HashCacheService {
  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: RedisClientType | null,
  ) {}

  async hset(
    key: string,
    field: string,
    value: string | number,
  ): Promise<void> {
    if (!this.redis) return;
    await this.redis.hSet(key, field, String(value));
  }

  async hget(key: string, field: string): Promise<string | null> {
    if (!this.redis) return null;
    return this.redis.hGet(key, field);
  }

  async hmget(key: string, fields: string[]): Promise<(string | null)[]> {
    if (!this.redis) return fields.map(() => null);
    return this.redis.hmGet(key, fields);
  }

  async hgetall(key: string): Promise<Record<string, string>> {
    if (!this.redis) return {};
    return this.redis.hGetAll(key);
  }

  async hdel(key: string, ...fields: string[]): Promise<number> {
    if (!this.redis) return 0;
    return this.redis.hDel(key, fields);
  }

  async hincrby(
    key: string,
    field: string,
    increment: number,
  ): Promise<number> {
    if (!this.redis) return 0;
    return this.redis.hIncrBy(key, field, increment);
  }

  async expire(key: string, ttlSeconds: number): Promise<void> {
    if (!this.redis) return;
    await this.redis.expire(key, ttlSeconds);
  }
}
