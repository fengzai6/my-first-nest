import { HashCacheService } from '@/shared/caching/hash-cache.service';
import { RedisClientType } from '@redis/client';
import { beforeEach, describe, expect, it, MockInstance, vi } from 'vitest';

type MockRedis = {
  expire: MockInstance<(key: string, ttl: number) => Promise<boolean>>;
  hDel: MockInstance<(key: string, fields: string[]) => Promise<number>>;
  hGet: MockInstance<(key: string, field: string) => Promise<string | null>>;
  hGetAll: MockInstance<(key: string) => Promise<Record<string, string>>>;
  hIncrBy: MockInstance<
    (key: string, field: string, increment: number) => Promise<number>
  >;
  hSet: MockInstance<
    (key: string, field: string, value: string) => Promise<number>
  >;
  hmGet: MockInstance<(key: string, fields: string[]) => Promise<string[]>>;
};

const createRedis = (): MockRedis => ({
  expire: vi.fn(() => Promise.resolve(true)),
  hDel: vi.fn(() => Promise.resolve(1)),
  hGet: vi.fn(() => Promise.resolve('value')),
  hGetAll: vi.fn(() => Promise.resolve({ field: 'value' })),
  hIncrBy: vi.fn(() => Promise.resolve(2)),
  hSet: vi.fn(() => Promise.resolve(1)),
  hmGet: vi.fn(() => Promise.resolve(['a', 'b'])),
});

describe('HashCacheService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should no-op safely when redis is unavailable', async () => {
    const service = new HashCacheService(null);

    await expect(service.hset('key', 'field', 1)).resolves.toBeUndefined();
    await expect(service.hget('key', 'field')).resolves.toBeNull();
    await expect(service.hmget('key', ['a', 'b'])).resolves.toEqual([
      null,
      null,
    ]);
    await expect(service.hgetall('key')).resolves.toEqual({});
    await expect(service.hdel('key', 'field')).resolves.toBe(0);
    await expect(service.hincrby('key', 'field', 1)).resolves.toBe(0);
    await expect(service.expire('key', 60)).resolves.toBeUndefined();
  });

  it('should delegate hash operations to redis', async () => {
    const redis = createRedis();
    const service = new HashCacheService(redis as unknown as RedisClientType);

    await service.hset('key', 'field', 1);
    await expect(service.hget('key', 'field')).resolves.toBe('value');
    await expect(service.hmget('key', ['a', 'b'])).resolves.toEqual(['a', 'b']);
    await expect(service.hgetall('key')).resolves.toEqual({ field: 'value' });
    await expect(service.hdel('key', 'a', 'b')).resolves.toBe(1);
    await expect(service.hincrby('key', 'field', 2)).resolves.toBe(2);
    await service.expire('key', 60);

    expect(redis.hSet).toHaveBeenCalledWith('key', 'field', '1');
    expect(redis.hDel).toHaveBeenCalledWith('key', ['a', 'b']);
    expect(redis.expire).toHaveBeenCalledWith('key', 60);
  });

  it('should avoid redis call for empty bulk fields', async () => {
    const redis = createRedis();
    const service = new HashCacheService(redis as unknown as RedisClientType);

    await expect(service.hmget('key', [])).resolves.toEqual([]);
    await expect(service.hdel('key')).resolves.toBe(0);
    expect(redis.hmGet).not.toHaveBeenCalled();
    expect(redis.hDel).not.toHaveBeenCalled();
  });
});
