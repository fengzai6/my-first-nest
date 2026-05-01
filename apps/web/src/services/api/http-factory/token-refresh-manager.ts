export class TokenRefreshManager {
  private refreshingPromise: Promise<string> | null = null;

  async runRefresh(task: () => Promise<string>): Promise<string> {
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
