import { TypeOrmModuleOptions } from '@nestjs/typeorm';

export interface ServerConfig {
  /** HTTP 监听端口 */
  port?: number;
  /** 全局 API 前缀，例如 `api` */
  apiPrefix?: string;
  /** 请求超时时间，单位秒 */
  timeout?: number;
}

export interface SwaggerConfig {
  /** 是否启用 Swagger */
  enabled?: boolean;
  /** Swagger UI 路径，不含前导斜杠 */
  path?: string;
  /** 文档标题 */
  title?: string;
  /** 文档描述 */
  description?: string;
  /** 文档版本号 */
  version?: string;
}

export interface JwtConfig {
  /** 签名和校验 JWT 的密钥 */
  secret?: string;
  /** access token 过期时间，单位秒 */
  accessExpiresIn?: number;
  /** refresh token 过期时间，单位秒 */
  refreshExpiresIn?: number;
}

export interface SnowflakeConfig {
  /** 工作节点 ID，范围 0-31 */
  workerId: number;
  /** 数据中心 ID，范围 0-31 */
  datacenterId: number;
}

export interface RedisConfig {
  /** Redis 连接 URL，与 host 二选一 */
  url?: string;
  /** Redis 主机，与 url 二选一 */
  host?: string;
  /** Redis 端口 */
  port?: number;
  /** Redis 密码 */
  password?: string;
  /** Redis DB 索引，范围 0-15 */
  db?: number;
  /** 缓存默认 TTL，单位秒；0 表示不过期 */
  defaultTtl?: number;
  /** 缓存和队列的 Key 前缀 */
  keyPrefix?: string;
}

export interface ThrottlerConfig {
  /** 默认限流窗口，单位毫秒 */
  ttl: number;
  /** 窗口内最大请求数 */
  limit: number;
}

export interface SeqConfig {
  /** 是否启用 Seq HTTP Push */
  enabled: boolean;
  /** Seq 服务器地址 */
  url?: string;
  /** Seq API Key */
  apiKey?: string;
  /** Seq 请求超时时间，单位毫秒 */
  timeoutMs: number;
}

export interface LogConfig {
  /** 日志保留天数 */
  retentionDays: number;
  /** 日志批量写入条数 */
  batchSize: number;
  /** 日志批量刷新间隔，单位毫秒 */
  flushIntervalMs: number;
  /** Seq 配置 */
  seq: SeqConfig;
}

export interface AppConfig {
  /** HTTP 服务配置 */
  server?: ServerConfig;
  /** Swagger 文档配置 */
  swagger?: SwaggerConfig;
  /** TypeORM 数据库配置 */
  database?: TypeOrmModuleOptions;
  /** JWT 鉴权配置 */
  jwt?: JwtConfig;
  /** 雪花 ID 配置 */
  snowflake?: SnowflakeConfig;
  /** Redis 连接和缓存配置 */
  redis?: RedisConfig;
  /** 全局限流配置 */
  throttler?: ThrottlerConfig;
  /** 日志配置 */
  log?: LogConfig;
}

export type AppConfigForced = {
  [K in keyof AppConfig]-?: Required<NonNullable<AppConfig[K]>>;
};
