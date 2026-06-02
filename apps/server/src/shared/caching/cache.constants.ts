import { createHash } from 'crypto';

/**
 * 缓存 Key 命名空间集中维护，避免散落字符串拼接。
 * 最终落地 Key = `${REDIS_KEY_PREFIX}${业务命名空间}:...`
 */
export const hashCacheToken = (token: string): string => {
  return createHash('sha256').update(token).digest('hex');
};

export const CacheKeys = {
  USER_BY_ID: (id: string | number) => `users:${id}`,
  BENCHMARK_USER_BY_ID: (id: string | number) => `benchmark:users:${id}`,
  USER_BY_USERNAME: (username: string) => `users:username:${username}`,
  ROLE_TREE: (roleId: string | number) => `roles:tree:${roleId}`,
  PERMISSION_BY_USER: (userId: string | number) => `permissions:user:${userId}`,
  AUTH_REFRESH_TOKEN: (token: string) =>
    `auth:refresh:${hashCacheToken(token)}`,
} as const;
