import { registerAs } from '@nestjs/config';
import { AppConfig } from '../configuration.interface';

export const developmentConfig = registerAs(
  'development',
  (): AppConfig => ({
    server: {},
    database: {
      url: process.env.DATABASE_URL,
      synchronize: true,
      // logging: true,
    },
    jwt: {
      accessExpiresIn: 60,
      refreshExpiresIn: 60 * 60,
    },
  }),
);
