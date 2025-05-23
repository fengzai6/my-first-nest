import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { merge } from 'es-toolkit';
import { AppConfig } from './configuration.interface';

export const getConfig = (configService: ConfigService): AppConfig => {
  // 获取默认配置
  const defaultConf = configService.get('default');

  // 获取环境特定配置
  const envConfig =
    process.env.NODE_ENV === 'production'
      ? configService.get('production')
      : configService.get('development');

  // 合并配置
  const mergedConfig = merge(defaultConf, envConfig);

  return mergedConfig;
};

export const getAppConfig = (app: INestApplication) => {
  const configService = app.get(ConfigService);

  return getConfig(configService);
};
