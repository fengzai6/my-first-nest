import { AppConfigModule } from '@/config/config.module';
import { getConfig } from '@/config/configuration';
import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DEFAULT_JOB_QUEUE } from '../constants/job.constants';

type RedisLike = {
  url?: string;
  host?: string;
  port?: number;
  password?: string;
  db?: number;
  keyPrefix?: string;
};

const buildRedisConnection = (redis: RedisLike) => {
  // BullMQ Worker 要求 maxRetriesPerRequest 为 null
  const base = {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  };

  if (redis.url) {
    // ioredis 支持 path/url 字段；这里解析为 host 风格更稳妥
    const parsed = new URL(redis.url);
    return {
      ...base,
      host: parsed.hostname,
      port: parsed.port ? Number(parsed.port) : 6379,
      username: parsed.username
        ? decodeURIComponent(parsed.username)
        : undefined,
      password: parsed.password
        ? decodeURIComponent(parsed.password)
        : undefined,
      db:
        parsed.pathname && parsed.pathname !== '/'
          ? Number(parsed.pathname.slice(1) || 0)
          : 0,
      tls: parsed.protocol === 'rediss:' ? {} : undefined,
    };
  }

  if (!redis.host) {
    throw new Error(
      '任务系统需要 Redis，请配置 REDIS_URL 或 REDIS_HOST（Jobs module requires Redis）',
    );
  }

  return {
    ...base,
    host: redis.host,
    port: redis.port ?? 6379,
    password: redis.password || undefined,
    db: redis.db ?? 0,
  };
};

const buildBullPrefix = (keyPrefix?: string) =>
  `${keyPrefix || 'my-first-nest:'}bull`;

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [AppConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const { redis } = getConfig(configService);
        return {
          connection: buildRedisConnection(redis),
          prefix: buildBullPrefix(redis.keyPrefix),
        };
      },
    }),
    BullModule.registerQueue({
      name: DEFAULT_JOB_QUEUE,
    }),
  ],
  exports: [BullModule],
})
export class JobQueueModule {}
