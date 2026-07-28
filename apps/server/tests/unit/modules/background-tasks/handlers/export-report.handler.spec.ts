import { ExportReportHandler } from '@/modules/background-tasks/handlers/export-report.handler';
import { JOB_NAMES } from '@/shared/jobs/constants/job.constants';
import { JobRegistryService } from '@/shared/jobs/registry/job-registry.service';
import { IJobContext } from '@/shared/jobs/types/job.types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('ExportReportHandler', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should register itself and produce progress + result', async () => {
    const register = vi.fn();
    const handler = new ExportReportHandler({
      register,
    } as unknown as JobRegistryService);

    expect(register).toHaveBeenCalledWith(handler);
    expect(handler.name).toBe(JOB_NAMES.EXPORT_REPORT);

    const updateProgress = vi.fn(async () => undefined);
    const ctx: IJobContext = {
      jobId: 'job-1',
      name: JOB_NAMES.EXPORT_REPORT,
      payload: { title: 'report', steps: 2, stepDelayMs: 100 },
      attemptsMade: 1,
      maxAttempts: 1,
      updateProgress,
    };

    const promise = handler.handle(ctx);
    await vi.advanceTimersByTimeAsync(100);
    await vi.advanceTimersByTimeAsync(100);
    const result = await promise;

    expect(updateProgress).toHaveBeenNthCalledWith(1, 50);
    expect(updateProgress).toHaveBeenNthCalledWith(2, 100);
    expect(result).toEqual({
      title: 'report',
      downloadUrl: 'mock://exports/job-1/report.csv',
      steps: 2,
    });
  });
});
