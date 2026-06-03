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
});
