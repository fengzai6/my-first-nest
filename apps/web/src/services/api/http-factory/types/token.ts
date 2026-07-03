/**
 * token 详细信息，用于主动刷新判断。
 */
export interface AccessTokenDetail {
  token: string;
  expiresAt: Date | string | number;
}

/**
 * getAccessToken 的返回值类型，兼容旧版纯字符串返回。
 */
export type AccessTokenResult = string | AccessTokenDetail | null;
