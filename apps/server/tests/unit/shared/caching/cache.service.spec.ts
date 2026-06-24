import { CacheService } from '@/shared/caching/cache.service';
import { describe, expect, it, MockInstance, vi } from 'vitest';

type MockCache = {
  del: MockInstance<(key: string) => Promise<boolean>>;
  get: MockInstance<(key: string) => Promise<string | undefined>>;
  mdel: MockInstance<(keys: string[]) => Promise<boolean>>;
  set: MockInstance<
    (key: string, value: string, ttl?: number) => Promise<string>
  >;
  stores: unknown[];
  wrap: MockInstance<
    (
      key: string,
      loader: () => Promise<string>,
      ttl?: number,
    ) => Promise<string>
  >;
};

const createCache = (stores: unknown[] = []): MockCache => ({
  del: vi.fn(() => Promise.resolve(true)),
  get: vi.fn(() => Promise.resolve('value')),
  mdel: vi.fn(() => Promise.resolve(true)),
  set: vi.fn((_, value: string) => Promise.resolve(value)),
  stores,
  wrap: vi.fn((_, loader: () => Promise<string>) => loader()),
});

const createMockRedisClient = ({
  namespace = '',
  keyPrefixSeparator = ':',
  useUnlink = false,
} = {}) => {
  const evalFn = vi.fn(() => Promise.resolve(1));
  const unlink = vi.fn(() => Promise.resolve(1));
  const del = vi.fn(() => Promise.resolve(1));
  const scanIterator = vi.fn(async function* () {
    await Promise.resolve();
    yield ['key1', 'key2'];
    yield 'key3';
  });

  return {
    client: { del, eval: evalFn, scanIterator, unlink },
    del,
    evalFn,
    keyPrefixSeparator,
    namespace,
    scanIterator,
    unlink,
    useUnlink,
  };
};

// Helper to create a CacheService with mocked getRedisStore
const createServiceWithRedis = (redisStore: Record<string, unknown> | null) => {
  const cache = createCache();
  const service = new CacheService(cache as never);

  if (redisStore) {
    // Mock the private getRedisStore method
    vi.spyOn(
      service as unknown as { getRedisStore: () => unknown },
      'getRedisStore',
    ).mockReturnValue(redisStore);
  }

  return { cache, service };
};

describe('CacheService', () => {
  it('should delegate get set del and wrap to cache manager', async () => {
    const cache = createCache();
    const service = new CacheService(cache as never);

    await expect(service.get('key')).resolves.toBe('value');
    await expect(service.set('key', 'value', 60)).resolves.toBe('value');
    await expect(service.del('key')).resolves.toBe(true);
    await expect(service.del(['a', 'b'])).resolves.toBe(true);
    await expect(
      service.wrap('key', () => Promise.resolve('loaded'), 30),
    ).resolves.toBe('loaded');

    expect(cache.set).toHaveBeenCalledWith('key', 'value', 60_000);
    expect(cache.del).toHaveBeenCalledWith('key');
    expect(cache.mdel).toHaveBeenCalledWith(['a', 'b']);
    expect(cache.wrap).toHaveBeenCalledWith(
      'key',
      expect.any(Function),
      30_000,
    );
  });

  it('should report redis disabled and skip redis-only operations', async () => {
    const cache = createCache();
    const service = new CacheService(cache as never);

    expect(service.isRedisEnabled()).toBe(false);
    await expect(
      service.rotateRefreshToken('old', 'new', 'user-id', 60),
    ).resolves.toBe(false);
    await expect(service.invalidatePattern('users:*')).resolves.toBe(0);
  });

  it('should set without ttl when ttlSeconds is not provided', async () => {
    const cache = createCache();
    const service = new CacheService(cache as never);

    await service.set('key', 'value');

    expect(cache.set).toHaveBeenCalledWith('key', 'value', undefined);
  });

  it('should wrap without ttl when ttlSeconds is not provided', async () => {
    const cache = createCache();
    const service = new CacheService(cache as never);

    await service.wrap('key', () => Promise.resolve('loaded'));

    expect(cache.wrap).toHaveBeenCalledWith(
      'key',
      expect.any(Function),
      undefined,
    );
  });

  it('should detect redis store and enable redis mode', () => {
    const redisClient = createMockRedisClient();
    const { service } = createServiceWithRedis(redisClient);

    expect(service.isRedisEnabled()).toBe(true);
  });

  it('should rotate refresh token via lua script', async () => {
    const redisClient = createMockRedisClient();
    const { service } = createServiceWithRedis(redisClient);

    const result = await service.rotateRefreshToken(
      'old-token',
      'new-token',
      'expected-value',
      60,
    );

    expect(result).toBe(true);
    expect(redisClient.evalFn).toHaveBeenCalledWith(expect.any(String), {
      keys: ['old-token', 'new-token'],
      arguments: ['expected-value', '60000'],
    });
  });

  it('should rotate refresh token with namespace', async () => {
    const redisClient = createMockRedisClient({
      keyPrefixSeparator: ':',
      namespace: 'myapp',
    });
    const { service } = createServiceWithRedis(redisClient);

    await service.rotateRefreshToken('old', 'new', 'val', 60);

    expect(redisClient.evalFn).toHaveBeenCalledWith(expect.any(String), {
      keys: ['myapp:old', 'myapp:new'],
      arguments: ['val', '60000'],
    });
  });

  it('should return false when lua script returns 0', async () => {
    const redisClient = createMockRedisClient();
    redisClient.evalFn.mockResolvedValue(0);
    const { service } = createServiceWithRedis(redisClient);

    const result = await service.rotateRefreshToken('old', 'new', 'val', 60);

    expect(result).toBe(false);
  });

  it('should invalidate pattern using unlink when useUnlink is true', async () => {
    const redisClient = createMockRedisClient({ useUnlink: true });
    const { service } = createServiceWithRedis(redisClient);

    const result = await service.invalidatePattern('users:*');

    expect(redisClient.unlink).toHaveBeenCalled();
    expect(redisClient.del).not.toHaveBeenCalled();
    expect(result).toBeGreaterThanOrEqual(1);
  });

  it('should invalidate pattern using del when useUnlink is false', async () => {
    const redisClient = createMockRedisClient({ useUnlink: false });
    const { service } = createServiceWithRedis(redisClient);

    const result = await service.invalidatePattern('users:*');

    expect(redisClient.del).toHaveBeenCalled();
    expect(redisClient.unlink).not.toHaveBeenCalled();
    expect(result).toBeGreaterThanOrEqual(1);
  });

  it('should invalidate pattern with namespace prefix', async () => {
    const redisClient = createMockRedisClient({
      namespace: 'myapp',
      useUnlink: false,
    });
    const { service } = createServiceWithRedis(redisClient);

    await service.invalidatePattern('users:*');

    expect(redisClient.scanIterator).toHaveBeenCalledWith({
      MATCH: 'myapp:users:*',
      COUNT: 200,
    });
  });

  it('should handle string chunks from scanIterator', async () => {
    const del = vi.fn(() => Promise.resolve(1));
    const scanIterator = vi.fn(async function* () {
      await Promise.resolve();
      yield 'single-key';
    });

    const redisClient = {
      client: { del, eval: vi.fn(), scanIterator, unlink: vi.fn() },
      del,
      keyPrefixSeparator: ':',
      namespace: '',
      scanIterator,
      useUnlink: false,
    };

    const { service } = createServiceWithRedis(redisClient);
    const result = await service.invalidatePattern('test:*');

    expect(del).toHaveBeenCalledWith(['single-key']);
    expect(result).toBeGreaterThanOrEqual(1);
  });

  it('should handle empty scanIterator result', async () => {
    const del = vi.fn(() => Promise.resolve(0));
    const scanIterator = vi.fn(async function* () {
      // empty
    });

    const redisClient = {
      client: { del, eval: vi.fn(), scanIterator, unlink: vi.fn() },
      del,
      keyPrefixSeparator: ':',
      namespace: '',
      scanIterator,
      useUnlink: false,
    };

    const { service } = createServiceWithRedis(redisClient);
    const result = await service.invalidatePattern('empty:*');

    expect(del).not.toHaveBeenCalled();
    expect(result).toBe(0);
  });
});
