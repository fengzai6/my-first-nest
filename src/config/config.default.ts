import { registerAs } from '@nestjs/config';
import { SnakeNamingStrategy } from '../shared/database/snake-naming.strategy';
import { AppConfig } from './configuration.interface';

export const defaultConfig = registerAs(
  'default',
  (): AppConfig => ({
    server: {
      port: process.env.PORT,
      apiPrefix: 'api',
    },
    swagger: {
      enabled: true,
      path: 'swagger',
      title: 'NestJS API',
      description: 'The NestJS API description',
      version: '1.0',
    },
    database: {
      type: 'postgres',
      host: 'localhost',
      port: 5432,
      username: 'postgres',
      password: 'postgres',
      // entities: [__dirname + '/**/*.entity{.ts,.js}'],
      autoLoadEntities: true,
      namingStrategy: new SnakeNamingStrategy(),
    },
    jwt: {
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: 60 * 60 },
    },
  }),
);
