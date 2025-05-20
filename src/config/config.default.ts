import { AppConfig } from './configuration.interface';

export const defaultConfig: AppConfig = {
  server: {
    port: process.env.PORT,
  },
  swagger: {
    enabled: true,
    path: 'docs',
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
    entities: [__dirname + '/**/*.entity{.ts,.js}'],
  },
  jwt: {
    secret: process.env.JWT_SECRET,
    signOptions: { expiresIn: process.env.JWT_EXPIRES_IN },
  },
};
