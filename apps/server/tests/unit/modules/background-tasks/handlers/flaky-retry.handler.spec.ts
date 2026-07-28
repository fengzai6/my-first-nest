import { FlakyRetryHandler } from '@/modules/background-tasks/handlers/flaky-retry.handler';
import { JOB_NAMES } from '@/shared/jobs/constants/job.constants';
import { JobRegistryService } from '@/shared/jobs/registry/job-registry.service';
import { IJobContext } from '@/shared/jobs/types/job.types';
import { describe, expect, it, vi } from 'vitest';

const createCtx = (attemptsMade: number, failTimes = 2): IJobContext => ({
  jobId: 'job-1',
  name: JOB_NAMES.FLAKY_RETRY,
  payload: { failTimes },
  attemptsMade,
  maxAttempts: 3,
  updateProgress: vi.fn(() => Promise.resolve()),
});

describe('FlakyRetryHandler', () => {
  it('should register itself on construct', () => {
    const register = vi.fn();
    const handler = new FlakyRetryHandler({
      register,
    } as unknown as JobRegistryService);

    expect(register).toHaveBeenCalledWith(handler);
    expect(handler.name).toBe(JOB_NAMES.FLAKY_RETRY);
  });

  it('should fail while attemptsMade <= failTimes', async () => {
    const handler = new FlakyRetryHandler({
      register: vi.fn(),
    } as unknown as JobRegistryService);

    await expect(handler.handle(createCtx(1))).rejects.toThrow(
      'Simulated failure on attempt 1/3',
    );
    await expect(handler.handle(createCtx(2))).rejects.toThrow(
      'Simulated failure on attempt 2/3',
    );
  });

  it('should succeed after failTimes and update progress', async () => {
    const handler = new FlakyRetryHandler({
      register: vi.fn(),
    } as unknown as JobRegistryService);
    const ctx = createCtx(3);

    const result = await handler.handle(ctx);

    expect(ctx.updateProgress).toHaveBeenCalledWith(100);
    expect(result).toEqual({
      recovered: true,
      attemptsMade: 3,
      failTimes: 2,
    });
  });
});
