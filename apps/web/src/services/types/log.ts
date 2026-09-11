export const LOG_LEVEL = {
  DEBUG: "debug",
  INFO: "info",
  WARN: "warn",
  ERROR: "error",
  FATAL: "fatal",
} as const;

export type LogLevel = (typeof LOG_LEVEL)[keyof typeof LOG_LEVEL];

export const LOG_CATEGORY = {
  HTTP: "HTTP",
  AUTH: "Auth",
  SOCKET: "Socket",
  JOB: "Job",
  SCHEDULED_TASK: "ScheduledTask",
  BUSINESS: "Business",
} as const;

export interface ILogRecord {
  id: string;
  level: LogLevel;
  category: string;
  message: string;
  context: Record<string, unknown> | null;
  requestId: string | null;
  userId: string | null;
  ip: string | null;
  method: string | null;
  url: string | null;
  statusCode: number | null;
  duration: number | null;
  stack: string | null;
  timestamp: string;
}

export interface ILogsPage {
  items: ILogRecord[];
  total: number;
  page: number;
  pageSize: number;
}
