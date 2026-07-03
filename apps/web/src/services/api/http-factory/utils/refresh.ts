import type { InternalAxiosRequestConfig } from "axios";
import axios from "axios";
import type { RequestRetryState } from "../types/common";
import type { RetryPolicy } from "../types/http-client-options";

/** 默认重试延迟上限（毫秒） */
const DEFAULT_RETRY_DELAY_CAP = 30000;

/**
 * 默认的重试判断逻辑。
 * 网络错误（AxiosError 无 response）或 5xx 状态码时重试。
 * 非 AxiosError（如编程错误）不重试。
 */
export const defaultShouldRetry = (error: unknown): boolean => {
  // 非 AxiosError 不重试（如 onBusinessResponse 抛出的普通 Error）
  if (!axios.isAxiosError(error)) {
    return false;
  }

  // 网络错误（无 response）重试
  if (!error.response) {
    return true;
  }

  // 5xx 状态码重试
  return error.response.status >= 500;
};

/**
 * 默认的重试延迟计算。
 * 指数退避：1000 * 2^retryCount，上限 30 秒。
 */
export const defaultRetryDelay = (retryCount: number): number => {
  return Math.min(1000 * Math.pow(2, retryCount), DEFAULT_RETRY_DELAY_CAP);
};

/**
 * 解析重试策略，补齐默认值。
 */
export const resolveRetryPolicy = (
  retryPolicy?: RetryPolicy,
): Required<RetryPolicy> | null => {
  if (!retryPolicy) {
    return null;
  }

  const maxRetries = retryPolicy.maxRetries ?? 0;

  if (maxRetries <= 0) {
    return null;
  }

  return {
    maxRetries,
    shouldRetry: retryPolicy.shouldRetry ?? defaultShouldRetry,
    retryDelay: retryPolicy.retryDelay ?? defaultRetryDelay,
  };
};

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
