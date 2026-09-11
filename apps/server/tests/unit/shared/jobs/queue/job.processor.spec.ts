import {
  ErrorException,
  ErrorExceptionCode,
} from '@/common/exceptions/error.exception';
import { LOG_CATEGORY } from '@/shared/log/constants/log.constants';
import type { ILogWriteOptions } from '@/shared/log/interfaces/log.interface';
import { JobProcessor } from '@/shared/jobs/queue/job.processor';
import { JobRecordService } from '@/shared/jobs/records/job-record.service';
import { JobRegistryService } from '@/shared/jobs/registry/job-registry.service';
import { IJobContext, IJobHandler } from '@/shared/jobs/types/job.types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const createJob = (overrides: Record<string, unknown> = {}) => {
  return {
    id: 'bull-1',
    data: {
      jobId: 'job-1',
      name: 'export-report',
      payload: { title: 'report' },
    },
    opts: { attempts: 3 },
    attemptsMade: 0,
    updateProgress: vi.fn(() => Promise.resolve()),
    ...overrides,
  };
};

const createProcessor = () => {
  const registry = {
    get: vi.fn(),
  };
  const records = {
    markActive: vi.fn(() => Promise.resolve(true)),
    updateProgress: vi.fn(() => Promise.resolve()),
    markCompleted: vi.fn(() => Promise.resolve()),
    markAttemptFailure: vi.fn(() => Promise.resolve()),
  };
  const logger = {
    log: vi.fn<(message: string, options: ILogWriteOptions) => void>(),
    warn: vi.fn<(message: string, options: ILogWriteOptions) => void>(),
    error:
      vi.fn<
        (message: string, error?: unknown, options?: ILogWriteOptions) => void
      >(),
  };

  const processor = new JobProcessor(
    registry as unknown as JobRegistryService,
    records as unknown as JobRecordService,
    logger as never,
  );

  return { processor, registry, records, logger };
};

describe('JobProcessor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should mark active, execute handler and complete', async () => {
    const { processor, registry, records, logger } = createProcessor();
    const handle = vi.fn(async (ctx: IJobContext) => {
      await ctx.updateProgress(50);
      return { ok: true };
    });
    registry.get.mockReturnValue({
      name: 'export-report',
      handle,
    } satisfies IJobHandler);

    const job = createJob();
    const result = await processor.process(job as never);

    expect(records.markActive).toHaveBeenCalledWith('job-1', 'bull-1', 1);
    expect(handle).toHaveBeenCalledWith(
      expect.objectContaining({
        jobId: 'job-1',
        name: 'export-report',
        attemptsMade: 1,
        maxAttempts: 3,
      }),
    );
    expect(records.updateProgress).toHaveBeenCalledWith('job-1', 50);
    expect(job.updateProgress).toHaveBeenCalledWith(50);
    expect(records.markCompleted).toHaveBeenCalledWith(
      'job-1',
      { ok: true },
      1,
    );
    expect(result).toEqual({ ok: true });
    expect(logger.log).toHaveBeenCalledWith(
      'Job processing started',
      expect.objectContaining({ category: LOG_CATEGORY.JOB }),
    );
    expect(logger.log).toHaveBeenCalledWith(
      'Job processing completed',
      expect.objectContaining({ category: LOG_CATEGORY.JOB }),
    );
  });

  it('should mark retryable failure and rethrow', async () => {
    const { processor, registry, records, logger } = createProcessor();
    const error = new Error('boom');
    registry.get.mockReturnValue({
      name: 'flaky-retry',
      handle: vi.fn(() => {
        throw error;
      }),
    } satisfies IJobHandler);

    const job = createJob({
      data: { jobId: 'job-2', name: 'flaky-retry', payload: {} },
      attemptsMade: 0,
      opts: { attempts: 3 },
    });

    await expect(processor.process(job as never)).rejects.toThrow('boom');
    expect(records.markAttemptFailure).toHaveBeenCalledWith(
      'job-2',
      1,
      error,
      false,
    );
    expect(logger.error).toHaveBeenCalledWith(
      'Job processing failed',
      error,
      expect.objectContaining({ category: LOG_CATEGORY.JOB }),
    );
  });

  it('should mark final failure when attempts exhausted', async () => {
    const { processor, registry, records } = createProcessor();
    const error = new Error('final boom');
    registry.get.mockReturnValue({
      name: 'flaky-retry',
      handle: vi.fn(() => {
        throw error;
      }),
    } satisfies IJobHandler);

    const job = createJob({
      data: { jobId: 'job-3', name: 'flaky-retry', payload: {} },
      attemptsMade: 2,
      opts: { attempts: 3 },
    });

    await expect(processor.process(job as never)).rejects.toThrow('final boom');
    expect(records.markActive).toHaveBeenCalledWith('job-3', 'bull-1', 3);
    expect(records.markAttemptFailure).toHaveBeenCalledWith(
      'job-3',
      3,
      error,
      true,
    );
  });

  it('should mark final failure when handler is unregistered', async () => {
    const { processor, registry, records } = createProcessor();
    const error = new ErrorException(ErrorExceptionCode.JOB_HANDLER_NOT_FOUND);
    registry.get.mockImplementation(() => {
      throw error;
    });

    const job = createJob({
      data: { jobId: 'job-4', name: 'missing-handler', payload: {} },
      attemptsMade: 0,
      opts: { attempts: 1 },
    });

    await expect(processor.process(job as never)).rejects.toMatchObject({
      code: ErrorExceptionCode.JOB_HANDLER_NOT_FOUND,
    });
    expect(records.markActive).toHaveBeenCalledWith('job-4', 'bull-1', 1);
    expect(records.markAttemptFailure).toHaveBeenCalledWith(
      'job-4',
      1,
      error,
      true,
    );
  });

  it('should skip execution when activation loses to cancel', async () => {
    const { processor, registry, records, logger } = createProcessor();
    const handle = vi.fn(() => Promise.resolve({ ok: true }));
    registry.get.mockReturnValue({
      name: 'export-report',
      handle,
    } satisfies IJobHandler);
    records.markActive.mockResolvedValue(false);

    const job = createJob({
      data: { jobId: 'job-5', name: 'export-report', payload: {} },
    });

    const result = await processor.process(job as never);

    expect(records.markActive).toHaveBeenCalledWith('job-5', 'bull-1', 1);
    expect(registry.get).not.toHaveBeenCalled();
    expect(handle).not.toHaveBeenCalled();
    expect(records.markCompleted).not.toHaveBeenCalled();
    expect(result).toEqual({
      skipped: true,
      reason: 'not-cancellable-or-already-terminal',
    });
    expect(logger.warn).toHaveBeenCalledWith(
      'Job processing skipped',
      expect.objectContaining({ category: LOG_CATEGORY.JOB }),
    );
  });
});
