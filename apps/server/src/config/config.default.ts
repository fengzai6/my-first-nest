import { registerAs } from '@nestjs/config';
import { AppConfig } from './configuration.interface';

const parseNumberEnv = (
  value: string | undefined,
  fallback: number,
): number => {
  if (value === undefined) return fallback;

  const parsed = Number(value);
  return Number.isNaN(parsed) ? fallback : parsed;
};

export const defaultConfig = registerAs(
  'default',
  (): AppConfig => ({
    server: {
      port: process.env.PORT || 3000,
      apiPrefix: 'api',
      // 服务超时时间，单位：秒
      timeout: 60,
    },
    swagger: {
      enabled: process.env.SWAGGER_OPEN || true,
      path: 'swagger',
      title: 'NestJS API',
      description: 'The NestJS API description',
      version: '1.0',
    },
    database: {
      type: 'postgres',
      host: process.env.DATABASE_HOST || 'localhost',
      port: process.env.DATABASE_PORT || 5432,
      username: process.env.DATABASE_USERNAME || 'postgres',
      password: process.env.DATABASE_PASSWORD || 'postgres',
      database: process.env.DATABASE_NAME || 'first-nest',
      url: process.env.DATABASE_URL,
      synchronize: false,
    },
    jwt: {
      secret: process.env.JWT_SECRET || '123456',
      accessExpiresIn: Number(process.env.JWT_ACCESS_EXPIRES_IN) || 3600,
      refreshExpiresIn: Number(process.env.JWT_REFRESH_EXPIRES_IN) || 604800,
    },
    snowflake: {
      workerId: process.env.WORKER_ID || 0,
      datacenterId: process.env.DATACENTER_ID || 0,
    },
    redis: {
      url: process.env.REDIS_URL,
      host: process.env.REDIS_HOST,
      port: Number(process.env.REDIS_PORT) || 6379,
      password: process.env.REDIS_PASSWORD,
      db: Number(process.env.REDIS_DB) || 0,
      // 缓存默认 TTL，单位：秒（0 表示不过期）
      defaultTtl: parseNumberEnv(process.env.REDIS_DEFAULT_TTL, 300),
      keyPrefix: process.env.REDIS_KEY_PREFIX || 'my-first-nest:',
    },
    throttler: {
      // 默认时间窗口：60 秒（毫秒）
      ttl: Number(process.env.THROTTLER_TTL) || 60_000,
      // 窗口内最大请求数
      limit: Number(process.env.THROTTLER_LIMIT) || 60,
    },
    log: {
      retentionDays: parseNumberEnv(process.env.LOG_RETENTION_DAYS, 30),
      batchSize: parseNumberEnv(process.env.LOG_BATCH_SIZE, 50),
      flushIntervalMs: parseNumberEnv(process.env.LOG_FLUSH_INTERVAL_MS, 5000),
      seq: {
        enabled: process.env.SEQ_ENABLED === 'true',
        url: process.env.SEQ_URL,
        apiKey: process.env.SEQ_API_KEY,
        timeoutMs: parseNumberEnv(process.env.SEQ_TIMEOUT_MS, 5000),
      },
    },
    upload: {
      dir: process.env.UPLOAD_DIR || 'uploads',
      urlPrefix: process.env.UPLOAD_URL_PREFIX || '/api/attachments/content',
      signedUrlExpiresIn: parseNumberEnv(
        process.env.UPLOAD_SIGNED_URL_EXPIRES_IN,
        300,
      ),
      secret: process.env.UPLOAD_SIGNATURE_SECRET,
    },
  }),
);
