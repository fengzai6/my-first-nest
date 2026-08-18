import { TokenRefreshManager } from "fzkit/http-client";

export const AUTH_REFRESH_SCOPE_KEY = Symbol("primary-auth");

export const tokenRefreshManager = new TokenRefreshManager();
