import type { AccessTokenResult } from "./types";

export const REFRESH_SKIPPED = Symbol("REFRESH_SKIPPED");

export class TokenRefreshManager {
  private refreshingPromise: Promise<AccessTokenResult> | null = null;
  private lastRefreshTime: number | null = null;
  private readonly cooldownMs: number;

  constructor(cooldownMs = 15_000) {
    this.cooldownMs = cooldownMs;
  }

  async runRefresh(
    task: () => Promise<AccessTokenResult>,
  ): Promise<AccessTokenResult | typeof REFRESH_SKIPPED> {
    // 冷却期内跳过刷新
    if (
      this.lastRefreshTime !== null &&
      Date.now() - this.lastRefreshTime < this.cooldownMs
    ) {
      return REFRESH_SKIPPED;
    }

    if (!this.refreshingPromise) {
      this.refreshingPromise = (async () => {
        try {
          const result = await task();
          this.lastRefreshTime = Date.now();
          return result;
        } finally {
          this.refreshingPromise = null;
        }
      })();
    }

    return this.refreshingPromise;
  }
}
