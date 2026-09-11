import type { LogLevel } from "../types/log";

export interface IFindLogsQuery {
  page?: number;
  pageSize?: number;
  level?: LogLevel;
  category?: string;
  userId?: string;
  requestId?: string;
  startTime?: string;
  endTime?: string;
  keyword?: string;
}
