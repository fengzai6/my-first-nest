import { LogLevel } from '../constants/log.constants';

export interface ILogEvent {
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
  timestamp: Date;
}

export type IQueuedLogEvent = Omit<ILogEvent, 'timestamp'> & {
  timestamp: string;
};

export interface ILogWriteOptions {
  category?: string;
  context?: Record<string, unknown> | null;
  requestId?: string | null;
  userId?: string | null;
  ip?: string | null;
  method?: string | null;
  url?: string | null;
  statusCode?: number | null;
  duration?: number | null;
  stack?: string | null;
  timestamp?: Date;
}

export interface IQueryLogs {
  page?: number;
  pageSize?: number;
  level?: LogLevel;
  category?: string;
  userId?: string;
  requestId?: string;
  startTime?: Date;
  endTime?: Date;
  keyword?: string;
}

export interface ILogPage {
  items: ILogEvent[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ILogBatchJobData {
  events: IQueuedLogEvent[];
}
