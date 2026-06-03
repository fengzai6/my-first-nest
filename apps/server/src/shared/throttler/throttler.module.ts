import { Module } from '@nestjs/common';
import { ThrottlerModule as NestThrottlerModule } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';
import { AppConfigModule } from '@/config/config.module';
import { getConfig } from '@/config/configuration';
import { RedisCacheModule } from '@/shared/caching/cache.module';
import { REDIS_CLIENT } from '@/shared/caching/cache.tokens';
import { RedisThrottlerStorage } from './redis-throttler-storage';
import type { RedisClientType } from '@redis/client';

@Module({
  imports: [
    NestThrottlerModule.forRootAsync({
      imports: [AppConfigModule, RedisCacheModule],
      inject: [ConfigService, REDIS_CLIENT],
      useFactory: (
        configService: ConfigService,
        redisClient: RedisClientType | null,
      ) => {
        const { throttler } = getConfig(configService);

        const storage = new RedisThrottlerStorage(redisClient);

        return {
          throttlers: [{ ttl: throttler.ttl, limit: throttler.limit }],
          storage,
        };
      },
    }),
  ],
})
export class ThrottlerConfigModule {}
