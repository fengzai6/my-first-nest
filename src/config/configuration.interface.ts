import { TypeOrmModuleOptions } from '@nestjs/typeorm';

export interface ServerConfig {
  port?: number;
  apiPrefix?: string;
  timeout?: number;
}

export interface SwaggerConfig {
  enabled?: boolean;
  path?: string;
  title?: string;
  description?: string;
  version?: string;
}

export interface JwtConfig {
  secret?: string;
  accessExpiresIn?: number;
  refreshExpiresIn?: number;
}

export interface SnowflakeConfig {
  workerId: number;
  datacenterId: number;
}

export interface AppConfig {
  server?: ServerConfig;
  swagger?: SwaggerConfig;
  database?: TypeOrmModuleOptions;
  jwt?: JwtConfig;
  snowflake?: SnowflakeConfig;
}

export type AppConfigForced = {
  [K in keyof AppConfig]-?: Required<NonNullable<AppConfig[K]>>;
};
