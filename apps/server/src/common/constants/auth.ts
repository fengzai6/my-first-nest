export const REFRESH_TOKEN_KEY = 'refreshToken';

export const AUTH_THROTTLE = {
  signup: { ttl: 3_600_000, limit: 3 },
  login: { ttl: 60_000, limit: 5 },
  refreshToken: { ttl: 60_000, limit: 10 },
  logout: { ttl: 60_000, limit: 10 },
} as const;

export enum TokenType {
  ACCESS = 'access',
  REFRESH = 'refresh',
}
