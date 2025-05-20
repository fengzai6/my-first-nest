import { JwtModuleOptions } from '@nestjs/jwt';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';

// export enum Config {
//   SERVER = 'server',
//   SWAGGER = 'swagger',
//   DATABASE = 'database',
//   JWT = 'jwt',
// }

export interface ServerConfig {
  port?: number;
}

export interface SwaggerConfig {
  enabled?: boolean;
  path?: string;
  title?: string;
  description?: string;
  version?: string;
}

export interface AppConfig {
  server?: ServerConfig;
  swagger?: SwaggerConfig;
  database?: TypeOrmModuleOptions;
  jwt?: JwtModuleOptions;
}
