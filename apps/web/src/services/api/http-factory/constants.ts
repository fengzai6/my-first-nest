/** 默认错误消息 */
export const DEFAULT_MESSAGES = {
  refreshTokenExpired: "refreshToken 已失效，登录过期",
  loginExpired: "登录已失效，请重新登录",
  refreshDisabled: "未启用 refresh token 逻辑",
} as const;

/** 默认 token 刷新缓冲时间（毫秒） */
export const DEFAULT_REFRESH_BUFFER_MS = 0;
