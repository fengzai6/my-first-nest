import { AppConfig } from '../configuration.interface';

export const productionConfig: AppConfig = {
  server: {
    port: 3000,
  },
  swagger: {
    enabled: false,
  },
  database: {
    type: 'postgres',
    host: 'localhost',
    port: 5432,
    username: 'postgres',
    password: 'postgres',
  },
  jwt: {
    secret: 'secret',
    signOptions: { expiresIn: '1h' },
  },
};
