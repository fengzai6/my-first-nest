import { registerAs } from '@nestjs/config';
import { AppConfig } from './configuration.interface';

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
      accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || 3600,
      refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || 604800,
    },
    snowflake: {
      workerId: process.env.WORKER_ID || 0,
      datacenterId: process.env.DATACENTER_ID || 0,
    },
  }),
);
