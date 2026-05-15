import * as Joi from 'joi';

export const validationSchema = Joi.object({
  // Database
  DATABASE_URL: Joi.string(),
  DATABASE_HOST: Joi.string(),
  DATABASE_PORT: Joi.number().port().default(5432),
  DATABASE_USERNAME: Joi.string(),
  DATABASE_PASSWORD: Joi.string(),
  DATABASE_NAME: Joi.string(),
  DATABASE_SYNCHRONIZE: Joi.boolean().default(false),

  // Initial Admin User
  DEFAULT_ADMIN_USERNAME: Joi.string().required(),
  DEFAULT_ADMIN_PASSWORD: Joi.string().required(),

  // JWT
  JWT_SECRET: Joi.string().required(),
  JWT_ACCESS_EXPIRES_IN: Joi.number().default(3600),
  JWT_REFRESH_EXPIRES_IN: Joi.number().default(604800),

  // Server
  PORT: Joi.number().port(),

  // Swagger
  SWAGGER_OPEN: Joi.boolean().default(true),

  // Snowflake ID Generator
  WORKER_ID: Joi.number().integer().min(0).max(31).default(0),
  DATACENTER_ID: Joi.number().integer().min(0).max(31).default(0),

  // Redis (可选；未配置时缓存模块降级为内存 store)
  REDIS_URL: Joi.string().uri({ scheme: ['redis', 'rediss'] }),
  REDIS_HOST: Joi.string(),
  REDIS_PORT: Joi.number().port().default(6379),
  REDIS_PASSWORD: Joi.string().allow(''),
  REDIS_DB: Joi.number().integer().min(0).max(15).default(0),
  REDIS_DEFAULT_TTL: Joi.number().integer().min(0).default(300),
  REDIS_KEY_PREFIX: Joi.string().default('my-first-nest:'),
  REDIS_REQUIRED: Joi.boolean().default(false),

  // Node Environment
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
})
  .xor('DATABASE_URL', 'DATABASE_HOST') // 使用 URL 或单独的连接参数
  .with('DATABASE_HOST', [
    'DATABASE_PORT',
    'DATABASE_USERNAME',
    'DATABASE_PASSWORD',
    'DATABASE_NAME',
  ])
  .oxor('REDIS_URL', 'REDIS_HOST'); // Redis 连接二选一，也可都不提供
