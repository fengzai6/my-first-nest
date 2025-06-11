import { registerAs } from '@nestjs/config';
import { AppConfig } from '../configuration.interface';

export const developmentConfig = registerAs(
  'development',
  (): AppConfig => ({
    database: {
      url: process.env.DATABASE_URL,
      synchronize: true,
      // logging: true,
    },
    jwt: {
      signOptions: {
        expiresIn: 60 * 60 * 24 * 30,
      },
    },
  }),
);
