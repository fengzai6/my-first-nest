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

const createCache = (): MockCache => ({
  del: vi.fn(() => Promise.resolve(true)),
  get: vi.fn(() => Promise.resolve('value')),
  mdel: vi.fn(() => Promise.resolve(true)),
  set: vi.fn((_, value: string) => Promise.resolve(value)),
  stores: [],
  wrap: vi.fn((_, loader: () => Promise<string>) => loader()),
});

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
});
