/** Default error messages */
export const DEFAULT_MESSAGES = {
  refreshTokenExpired: "Refresh token is invalid or expired",
  loginExpired: "Login session has expired",
  refreshDisabled: "Refresh token flow is not enabled",
} as const;

/** Default proactive refresh buffer (ms) */
export const DEFAULT_REFRESH_BUFFER_MS = 0;

/** Default retry delay cap (ms) */
export const DEFAULT_RETRY_DELAY_CAP = 30000;
