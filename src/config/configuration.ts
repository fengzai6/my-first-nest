import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { merge } from 'es-toolkit';
import { AppConfig, AppConfigForced } from './configuration.interface';

/**
 * 通过 configService 获取配置
 * @param configService 配置服务
 * @returns 配置
 */
export const getConfig = (configService: ConfigService): AppConfigForced => {
  // 获取默认配置
  const defaultConf = configService.get<AppConfig>('default') as AppConfig;

  // 获取环境特定配置
  const envConfig =
    process.env.NODE_ENV === 'production'
      ? (configService.get<AppConfig>('production') as AppConfig)
      : (configService.get<AppConfig>('development') as AppConfig);

  // 合并配置
  const mergedConfig = merge(defaultConf, envConfig) as AppConfigForced;

  return mergedConfig;
};

/**
 * 通过 nestApp 获取配置
 * @param app 应用实例
 * @returns 应用配置
 */
export const getAppConfig = (app: INestApplication) => {
  const configService = app.get(ConfigService);

  return getConfig(configService);
};
