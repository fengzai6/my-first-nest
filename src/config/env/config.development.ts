import { registerAs } from '@nestjs/config';
import { AppConfig } from '../configuration.interface';

export const developmentConfig = registerAs(
  'development',
  (): AppConfig => ({
    database: {
      url: process.env.DATABASE_URL,
      synchronize: true,
    },
    jwt: {
      signOptions: {
        expiresIn: 10,
      },
    },
  }),
);
