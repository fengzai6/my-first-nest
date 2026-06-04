import { CacheKeys, hashCacheToken } from '@/shared/caching/cache.constants';
import { describe, expect, it } from 'vitest';

describe('cache constants', () => {
  it('should hash sensitive refresh token in cache key', () => {
    const token = 'plain-refresh-token';
    const hashed = hashCacheToken(token);

    expect(hashed).toHaveLength(64);
    expect(hashed).not.toContain(token);
    expect(CacheKeys.AUTH_REFRESH_TOKEN(token)).toBe(`auth:refresh:${hashed}`);
  });

  it('should generate correct key for USER_BY_ID', () => {
    expect(CacheKeys.USER_BY_ID(123)).toBe('users:123');
    expect(CacheKeys.USER_BY_ID('abc')).toBe('users:abc');
  });

  it('should generate correct key for BENCHMARK_USER_BY_ID', () => {
    expect(CacheKeys.BENCHMARK_USER_BY_ID(456)).toBe('benchmark:users:456');
    expect(CacheKeys.BENCHMARK_USER_BY_ID('xyz')).toBe('benchmark:users:xyz');
  });

  it('should generate correct key for USER_BY_USERNAME', () => {
    expect(CacheKeys.USER_BY_USERNAME('testuser')).toBe(
      'users:username:testuser',
    );
  });

  it('should generate correct key for ROLE_TREE', () => {
    expect(CacheKeys.ROLE_TREE(1)).toBe('roles:tree:1');
    expect(CacheKeys.ROLE_TREE('admin')).toBe('roles:tree:admin');
  });

  it('should generate correct key for PERMISSION_BY_USER', () => {
    expect(CacheKeys.PERMISSION_BY_USER(789)).toBe('permissions:user:789');
    expect(CacheKeys.PERMISSION_BY_USER('user-1')).toBe(
      'permissions:user:user-1',
    );
  });
});
