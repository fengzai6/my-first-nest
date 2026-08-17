import type { JobStatus } from "../types/job";

export interface IFindJobsQuery {
  name?: string;
  status?: JobStatus;
  page?: number;
  pageSize?: number;
}

export interface ISubmitExportReportDto {
  title?: string;
  steps?: number;
  stepDelayMs?: number;
  delayMs?: number;
}

export interface ISubmitFlakyRetryDto {
  failTimes?: number;
}
