import type {
  ISubmitExportReportDto,
  ISubmitFlakyRetryDto,
} from "../dtos/job";
import type { IJobRun } from "../types/job";
import http from "./new-http";

export const SubmitExportReport = async (data: ISubmitExportReportDto) => {
  const res = await http.post<IJobRun>("/background-tasks/export-report", data);

  return res.data;
};

export const SubmitFlakyRetry = async (data: ISubmitFlakyRetryDto) => {
  const res = await http.post<IJobRun>("/background-tasks/flaky-retry", data);

  return res.data;
};

export const SubmitCleanupExpiredRefreshTokens = async () => {
  const res = await http.post<IJobRun>(
    "/background-tasks/cleanup-expired-refresh-tokens",
  );

  return res.data;
};
