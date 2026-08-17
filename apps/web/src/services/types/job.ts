export const JOB_STATUS = {
  QUEUED: "queued",
  ACTIVE: "active",
  COMPLETED: "completed",
  FAILED: "failed",
  DELAYED: "delayed",
  CANCELLED: "cancelled",
} as const;

export type JobStatus = (typeof JOB_STATUS)[keyof typeof JOB_STATUS];

export const JOB_TRIGGER_TYPE = {
  MANUAL: "manual",
  CRON: "cron",
  SYSTEM: "system",
} as const;

export type JobTriggerType =
  (typeof JOB_TRIGGER_TYPE)[keyof typeof JOB_TRIGGER_TYPE];

export const JOB_NAMES = {
  EXPORT_REPORT: "export-report",
  FLAKY_RETRY: "flaky-retry",
  CLEANUP_EXPIRED_REFRESH_TOKENS: "cleanup-expired-refresh-tokens",
} as const;

export type JobName = (typeof JOB_NAMES)[keyof typeof JOB_NAMES];

export const JOB_TERMINAL_STATUSES: readonly JobStatus[] = [
  JOB_STATUS.COMPLETED,
  JOB_STATUS.FAILED,
  JOB_STATUS.CANCELLED,
] as const;

export const JOB_CANCELLABLE_STATUSES: readonly JobStatus[] = [
  JOB_STATUS.QUEUED,
  JOB_STATUS.DELAYED,
] as const;

export interface IJobRun {
  id: string;
  name: string;
  queueName: string;
  status: JobStatus;
  progress: number;
  payload?: unknown;
  result?: unknown;
  errorMessage?: string | null;
  attemptsMade: number;
  maxAttempts: number;
  triggerType: JobTriggerType;
  startedAt?: string | null;
  finishedAt?: string | null;
  createdAt: string;
}

export interface IJobsPage {
  list: IJobRun[];
  total: number;
  page: number;
  pageSize: number;
}
