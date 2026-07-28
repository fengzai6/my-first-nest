import { CleanupExpiredRefreshTokensHandler } from '@/modules/background-tasks/handlers/cleanup-expired-refresh-tokens.handler';
import { RefreshTokenService } from '@/modules/auth/refresh-token.service';
import { JOB_NAMES } from '@/shared/jobs/constants/job.constants';
import { JobRegistryService } from '@/shared/jobs/registry/job-registry.service';
import { IJobContext } from '@/shared/jobs/types/job.types';
import { describe, expect, it, vi } from 'vitest';

describe('CleanupExpiredRefreshTokensHandler', () => {
  it('should register itself and cleanup expired tokens', async () => {
    const register = vi.fn();
    const cleanupExpired = vi.fn(() => Promise.resolve({ deletedCount: 2 }));
    const handler = new CleanupExpiredRefreshTokensHandler(
      { register } as unknown as JobRegistryService,
      { cleanupExpired } as unknown as RefreshTokenService,
    );

    expect(register).toHaveBeenCalledWith(handler);
    expect(handler.name).toBe(JOB_NAMES.CLEANUP_EXPIRED_REFRESH_TOKENS);

    const updateProgress = vi.fn(() => Promise.resolve());
    const ctx: IJobContext<Record<string, never>> = {
      jobId: 'job-1',
      name: JOB_NAMES.CLEANUP_EXPIRED_REFRESH_TOKENS,
      payload: {},
      attemptsMade: 1,
      maxAttempts: 1,
      updateProgress,
    };

    const result = await handler.handle(ctx);

    expect(updateProgress).toHaveBeenCalledWith(10);
    expect(cleanupExpired).toHaveBeenCalledTimes(1);
    expect(updateProgress).toHaveBeenCalledWith(100);
    expect(result).toEqual({ deletedCount: 2 });
  });
});
