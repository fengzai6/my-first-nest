import { registerAs } from '@nestjs/config';
import { SnakeNamingStrategy } from '../shared/database/snake-naming.strategy';
import { AppConfig } from './configuration.interface';

export const defaultConfig = registerAs(
  'default',
  (): AppConfig => ({
    server: {
      port: process.env.PORT || 3000,
      apiPrefix: 'api',
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
      // entities: [__dirname + '/**/*.entity{.ts,.js}'],
      autoLoadEntities: true,
      namingStrategy: new SnakeNamingStrategy(),
    },
    jwt: {
      secret: process.env.JWT_SECRET || '123456',
      signOptions: { expiresIn: '8h' },
    },
    snowflake: {
      workerId: process.env.WORKER_ID || 0,
      datacenterId: process.env.DATACENTER_ID || 0,
    },
  }),
);
