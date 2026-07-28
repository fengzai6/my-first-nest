export const JOB_STATUS = {
  QUEUED: 'queued',
  ACTIVE: 'active',
  COMPLETED: 'completed',
  FAILED: 'failed',
  DELAYED: 'delayed',
  CANCELLED: 'cancelled',
} as const;

export type JobStatus = (typeof JOB_STATUS)[keyof typeof JOB_STATUS];

export const JOB_TRIGGER_TYPE = {
  MANUAL: 'manual',
  CRON: 'cron',
  SYSTEM: 'system',
} as const;

export type JobTriggerType =
  (typeof JOB_TRIGGER_TYPE)[keyof typeof JOB_TRIGGER_TYPE];

export const JOB_QUEUE_NAME = {
  DEFAULT: 'default',
} as const;

export const JOB_NAMES = {
  EXPORT_REPORT: 'export-report',
  FLAKY_RETRY: 'flaky-retry',
  CLEANUP_EXPIRED_REFRESH_TOKENS: 'cleanup-expired-refresh-tokens',
} as const;

export type JobName = (typeof JOB_NAMES)[keyof typeof JOB_NAMES];

/** BullMQ 默认队列名 */
export const DEFAULT_JOB_QUEUE = JOB_QUEUE_NAME.DEFAULT;
