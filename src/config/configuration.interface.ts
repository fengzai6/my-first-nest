import { JwtModuleOptions } from '@nestjs/jwt';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';

export interface ServerConfig {
  port?: number;
  apiPrefix?: string;
}

export interface SwaggerConfig {
  enabled?: boolean;
  path?: string;
  title?: string;
  description?: string;
  version?: string;
}

export interface SnowflakeConfig {
  workerId: number;
  datacenterId: number;
}

export interface AppConfig {
  server?: ServerConfig;
  swagger?: SwaggerConfig;
  database?: TypeOrmModuleOptions;
  jwt?: JwtModuleOptions;
  snowflake?: SnowflakeConfig;
}
