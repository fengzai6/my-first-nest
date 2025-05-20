import { AppConfig } from '../configuration.interface';

export const developmentConfig: Partial<AppConfig> = {
  database: {
    url: process.env.DATABASE_URL,
    synchronize: true,
  },
  jwt: {
    secret: 'secret',
    signOptions: { expiresIn: '1h' },
  },
};
