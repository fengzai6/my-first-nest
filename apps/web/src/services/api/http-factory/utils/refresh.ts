import type { InternalAxiosRequestConfig } from "axios";
import axios from "axios";
import { DEFAULT_RETRY_DELAY_CAP } from "../constants";
import type { RequestRetryState } from "../types/common";
import type { RetryPolicy } from "../types/http-client-options";

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
 *
 * 匹配规则：
 * - 使用路径边界匹配，而不是任意子串 includes
 * - 支持 exact / prefix 路径（例如 `/auth/login`、`/public`）
 * - `/auth` 不会误伤 `/user/auth-history` 或 `/authorization`
 */
export const shouldSkipRefresh = (
  skipRefreshUrls: string[],
  config?: InternalAxiosRequestConfig & RequestRetryState,
) => {
  const requestUrl = config?.url;

  if (!requestUrl) {
    return false;
  }

  const normalizedRequestPath = normalizeRequestPath(requestUrl);

  return skipRefreshUrls.some((skipUrl) =>
    matchesSkipPath(normalizedRequestPath, skipUrl),
  );
};

const normalizeRequestPath = (requestUrl: string): string => {
  // 兼容相对路径、绝对 URL、带 query/hash 的地址
  try {
    const parsed = new URL(requestUrl, "http://localhost");
    return parsed.pathname || "/";
  } catch {
    const withoutQuery = requestUrl.split("?")[0]?.split("#")[0] ?? requestUrl;
    return withoutQuery.startsWith("/") ? withoutQuery : `/${withoutQuery}`;
  }
};

const matchesSkipPath = (requestPath: string, skipUrl: string): boolean => {
  if (!skipUrl) {
    return false;
  }

  const normalizedSkip = skipUrl.startsWith("/") ? skipUrl : `/${skipUrl}`;
  const skipPath = normalizedSkip.replace(/\/+$/, "") || "/";
  const path = requestPath.replace(/\/+$/, "") || "/";

  if (path === skipPath || path.startsWith(`${skipPath}/`)) {
    return true;
  }

  // 允许匹配路径中的完整段序列（如 /api/auth/login 命中 /auth/login）
  // 但不会把 /auth 误匹配到 /user/auth-history 或 /authorization
  const pathSegments = path.split("/").filter(Boolean);
  const skipSegments = skipPath.split("/").filter(Boolean);

  if (skipSegments.length === 0 || skipSegments.length > pathSegments.length) {
    return false;
  }

  for (let i = 0; i <= pathSegments.length - skipSegments.length; i++) {
    const matched = skipSegments.every(
      (segment, index) => pathSegments[i + index] === segment,
    );
    if (matched) {
      return true;
    }
  }

  return false;
};

/**
 * 默认的刷新失败判断逻辑。
 */
export const defaultIsRefreshFailure = (
  error: unknown,
  options: { unauthorizedStatusCode: number; refreshFailureCodes: number[] },
): boolean => {
  // 非 AxiosError（编程错误 / 业务自定义 Error）默认不视为鉴权失败。
  // 若业务需要“抛 Error 即登出”，请自定义 isRefreshFailure。
  if (!axios.isAxiosError(error)) {
    return false;
  }

  // 无 response（网络错误）或 5xx 服务端错误：不代表 token 失效
  if (!error.response || error.response.status >= 500) {
    return false;
  }

  const status = error.response.status;
  const data = error.response.data as { code?: number } | undefined;

  return (
    status === options.unauthorizedStatusCode ||
    (data?.code !== undefined && options.refreshFailureCodes.includes(data.code))
  );
};
