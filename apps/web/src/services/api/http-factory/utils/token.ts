import type { AccessTokenResult } from "../types";

/**
 * 格式化 token（添加前缀）。
 */
export const formatAccessToken = (prefix: string, token: string) => {
  const normalizedPrefix = prefix.trim();
  return normalizedPrefix ? `${normalizedPrefix} ${token}` : token;
};

/**
 * 标准化 token 结果，提取 token 和 expiresAt。
 */
export const normalizeTokenResult = (result: AccessTokenResult) => {
  if (!result || typeof result === "string") {
    return { token: result ?? "", expiresAt: null };
  }

  // 验证 expiresAt 是否为有效的时间值
  const expiresAtValue = result.expiresAt;

  // 处理无效值：null、undefined、空字符串、0
  if (expiresAtValue == null || expiresAtValue === "" || expiresAtValue === 0) {
    return { token: result.token, expiresAt: null };
  }

  const expiresAtDate = new Date(expiresAtValue);

  // 检查是否为 Invalid Date
  if (Number.isNaN(expiresAtDate.getTime())) {
    return { token: result.token, expiresAt: null };
  }

  return {
    token: result.token,
    expiresAt: expiresAtDate,
  };
};

/**
 * 判断 token 是否即将过期。
 */
export const isTokenExpiringSoon = (
  expiresAt: Date,
  refreshBufferMs: number,
): boolean => {
  return Date.now() >= expiresAt.getTime() - refreshBufferMs;
};
