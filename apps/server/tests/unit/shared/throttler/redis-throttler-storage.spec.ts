import { RedisThrottlerStorage } from '@/shared/throttler/redis-throttler-storage';
import { RedisClientType } from '@redis/client';
import { beforeEach, describe, expect, it, MockInstance, vi } from 'vitest';

type MockRedis = {
  eval: MockInstance<
    (
      script: string,
      options: {
        keys: string[];
        arguments: string[];
      },
    ) => Promise<number>
  >;
  pTTL: MockInstance<(key: string) => Promise<number>>;
  set: MockInstance<
    (
      key: string,
      value: string,
      options: {
        PX: number;
      },
    ) => Promise<string>
  >;
};

const createRedis = (): MockRedis => ({
  eval: vi.fn(() => Promise.resolve(1)),
  pTTL: vi.fn(() => Promise.resolve(1000)),
  set: vi.fn(() => Promise.resolve('OK')),
});

describe('RedisThrottlerStorage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should degrade to unlimited when redis client is missing', async () => {
    const storage = new RedisThrottlerStorage(null);

    await expect(
      storage.increment('ip', 1000, 10, 5000, 'default'),
    ).resolves.toEqual({
      totalHits: 0,
      timeToExpire: 1000,
      isBlocked: false,
      timeToBlockExpire: 0,
    });
  });

  it('should return blocked status when block key exists', async () => {
    const redis = createRedis();
    const storage = new RedisThrottlerStorage(
      redis as unknown as RedisClientType,
    );

    redis.pTTL.mockResolvedValueOnce(3000);

    await expect(
      storage.increment('ip', 1000, 10, 5000, 'default'),
    ).resolves.toEqual({
      totalHits: 11,
      timeToExpire: 1000,
      isBlocked: true,
      timeToBlockExpire: 3000,
    });
    expect(redis.eval).not.toHaveBeenCalled();
  });

  it('should increment hits and allow request under limit', async () => {
    const redis = createRedis();
    const storage = new RedisThrottlerStorage(
      redis as unknown as RedisClientType,
    );

    redis.pTTL.mockResolvedValueOnce(-2).mockResolvedValueOnce(900);
    redis.eval.mockResolvedValue(2);

    await expect(
      storage.increment('ip', 1000, 10, 5000, 'default'),
    ).resolves.toEqual({
      totalHits: 2,
      timeToExpire: 900,
      isBlocked: false,
      timeToBlockExpire: 0,
    });
  });

  it('should set block key when hits exceed limit', async () => {
    const redis = createRedis();
    const storage = new RedisThrottlerStorage(
      redis as unknown as RedisClientType,
    );

    redis.pTTL.mockResolvedValueOnce(-2).mockResolvedValueOnce(800);
    redis.eval.mockResolvedValue(11);

    await expect(
      storage.increment('ip', 1000, 10, 5000, 'default'),
    ).resolves.toMatchObject({
      totalHits: 11,
      isBlocked: true,
      timeToBlockExpire: 5000,
    });
    expect(redis.set).toHaveBeenCalledWith('throttle:block:default:ip', '1', {
      PX: 5000,
    });
  });

  it('should degrade to unlimited when redis command fails', async () => {
    const redis = createRedis();
    const storage = new RedisThrottlerStorage(
      redis as unknown as RedisClientType,
    );

    redis.pTTL.mockRejectedValue(new Error('redis down'));

    await expect(
      storage.increment('ip', 1000, 10, 5000, 'default'),
    ).resolves.toEqual({
      totalHits: 0,
      timeToExpire: 1000,
      isBlocked: false,
      timeToBlockExpire: 0,
    });
  });
});
