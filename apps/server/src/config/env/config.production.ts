import { registerAs } from '@nestjs/config';
import { AppConfig } from '../configuration.interface';

export const productionConfig = registerAs(
  'production',
  (): AppConfig => ({
    server: {
      port: 80,
    },
    swagger: {},
    database: {
      synchronize: false,
    },
    jwt: {},
  }),
);
