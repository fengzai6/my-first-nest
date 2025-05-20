import { ConfigService, registerAs } from '@nestjs/config';
import { AppConfig } from './configuration.interface';
import { merge } from 'es-toolkit';
import { defaultConfig } from './config.default';
import { developmentConfig } from './env/config.development';
import { productionConfig } from './env/config.production';

const envConfig =
  process.env.NODE_ENV === 'production' ? productionConfig : developmentConfig;

const mergeConfig = merge(defaultConfig, envConfig);

console.log(mergeConfig);

export const serverConfig = registerAs('server', () => mergeConfig.server);

export const swaggerConfig = registerAs('swagger', () => mergeConfig.swagger);

export const jwtConfig = registerAs('jwt', () => mergeConfig.jwt);

export const databaseConfig = registerAs(
  'database',
  () => mergeConfig.database,
);

export const getConfig = (configService: ConfigService): AppConfig => ({
  server: configService.get('server'),
  swagger: configService.get('swagger'),
  jwt: configService.get('jwt'),
  database: configService.get('database'),
});
