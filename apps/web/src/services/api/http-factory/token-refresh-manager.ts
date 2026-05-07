import type { AccessTokenResult } from "./types";

export class TokenRefreshManager {
  private refreshingPromise: Promise<AccessTokenResult> | null = null;

  async runRefresh(task: () => Promise<AccessTokenResult>): Promise<AccessTokenResult> {
    if (!this.refreshingPromise) {
      this.refreshingPromise = (async () => {
        try {
          return await task();
        } finally {
          this.refreshingPromise = null;
        }
      })();
    }

    return this.refreshingPromise;
  }
}
