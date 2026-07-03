import type { InternalAxiosRequestConfig } from "axios";
import axios from "axios";
import type { RequestRetryState } from "../types";

/**
 * 判断是否跳过刷新流程。
 */
export const shouldSkipRefresh = (
  skipRefreshUrls: string[],
  config?: InternalAxiosRequestConfig & RequestRetryState,
) => {
  const requestUrl = config?.url;

  if (!requestUrl) {
    return false;
  }

  return skipRefreshUrls.some((url) => requestUrl.includes(url));
};

/**
 * 默认的刷新失败判断逻辑。
 */
export const defaultIsRefreshFailure = (
  error: unknown,
  options: { unauthorizedStatusCode: number; authFailureCodes: number[] },
): boolean => {
  if (!axios.isAxiosError(error) || !error.response) {
    return false;
  }

  const status = error.response.status;
  const data = error.response.data as { code?: number } | undefined;

  if (status && status >= 500) {
    return false;
  }

  return (
    status === options.unauthorizedStatusCode ||
    (data?.code !== undefined && options.authFailureCodes.includes(data.code))
  );
};
