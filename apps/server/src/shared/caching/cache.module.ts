import { getConfig } from '@/config/configuration';
import { CACHE_MANAGER, CacheModule } from '@nestjs/cache-manager';
import { Global, Logger, Module, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfigModule } from '@/config/config.module';
import KeyvRedis from '@keyv/redis';
import { Keyv } from 'keyv';
import { CacheService } from './cache.service';
import { CacheHealthIndicator } from './cache.health';
import { Inject } from '@nestjs/common';
import type { Cache } from 'cache-manager';

const buildRedisUrl = (redis: {
  url?: string;
  host?: string;
  port?: number;
  password?: string;
  db?: number;
}): string | undefined => {
  if (redis.url) return redis.url;
  if (!redis.host) return undefined;
  const auth = redis.password ? `:${encodeURIComponent(redis.password)}@` : '';
  const db = typeof redis.db === 'number' ? `/${redis.db}` : '';
  return `redis://${auth}${redis.host}:${redis.port ?? 6379}${db}`;
};

@Global()
@Module({
  imports: [
    CacheModule.registerAsync({
      isGlobal: true,
      imports: [AppConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const { redis } = getConfig(configService);
        const url = buildRedisUrl(redis);
        // ttl 单位：毫秒
        const ttl = redis.defaultTtl * 1000;

        if (!url) {
          // 未配置 Redis，使用 Keyv 默认内存 store
          return {
            stores: [new Keyv({ namespace: redis.keyPrefix })],
            ttl,
          };
        }

        const keyvRedis = new KeyvRedis(url, {
          namespace: redis.keyPrefix,
          // 默认 true 会在连接失败时抛错；本期降级策略由 OnApplicationBootstrap 处理
          throwOnConnectError: false,
        });
        return {
          stores: [new Keyv({ store: keyvRedis, namespace: redis.keyPrefix })],
          ttl,
        };
      },
    }),
  ],
  providers: [CacheService, CacheHealthIndicator],
  exports: [CacheService, CacheHealthIndicator, CacheModule],
})
export class RedisCacheModule implements OnApplicationBootstrap {
  private readonly logger = new Logger(RedisCacheModule.name);

  constructor(
    private readonly configService: ConfigService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
    private readonly health: CacheHealthIndicator,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const { redis } = getConfig(this.configService);
    const url = buildRedisUrl(redis);

    if (!url) {
      this.logger.warn('Redis 未配置，缓存模块使用内存 store');
      return;
    }

    const healthy = await this.health.ping();
    if (healthy) {
      this.logger.log(`Redis 连接正常 (prefix=${redis.keyPrefix})`);
      return;
    }

    if (redis.required) {
      this.logger.error('Redis 不可达且 REDIS_REQUIRED=true，启动终止');
      throw new Error('Redis is required but not reachable');
    }
    this.logger.warn('Redis 不可达，已降级使用内存 store');
  }
}
