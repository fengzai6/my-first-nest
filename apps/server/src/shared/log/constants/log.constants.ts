export const LOG_LEVEL = {
  DEBUG: 'debug',
  INFO: 'info',
  WARN: 'warn',
  ERROR: 'error',
  FATAL: 'fatal',
} as const;

export type LogLevel = (typeof LOG_LEVEL)[keyof typeof LOG_LEVEL];

export const LOG_CATEGORY = {
  HTTP: 'HTTP',
  AUTH: 'Auth',
  SOCKET: 'Socket',
  JOB: 'Job',
  SCHEDULED_TASK: 'ScheduledTask',
  BUSINESS: 'Business',
} as const;

export const LOG_QUEUE = {
  NAME: 'log-queue',
  JOB_NAME: 'persist-log-batch',
} as const;
