import { CleanupAttachmentsScheduler } from '@/modules/scheduled-tasks/cleanup-attachments.scheduler';
import {
  ErrorException,
  ErrorExceptionCode,
} from '@/common/exceptions/error.exception';
import {
  JOB_NAMES,
  JOB_TRIGGER_TYPE,
} from '@/shared/jobs/constants/job.constants';
import { JobService } from '@/shared/jobs/services/job.service';
import { LOG_CATEGORY } from '@/shared/log/constants/log.constants';
import { describe, expect, it, vi } from 'vitest';

describe('CleanupAttachmentsScheduler', () => {
  it('submits a cron cleanup job when no active or pending job exists', async () => {
    const jobService = {
      submitExclusive: vi.fn().mockResolvedValue({ id: 'job-id' }),
    };
    const logger = { log: vi.fn() };
    const scheduler = new CleanupAttachmentsScheduler(
      jobService as unknown as JobService,
      logger as never,
    );

    await scheduler.handleCleanup();

    expect(jobService.submitExclusive).toHaveBeenCalledWith({
      name: JOB_NAMES.CLEANUP_ATTACHMENTS,
      payload: {},
      attempts: 3,
      backoffMs: 2000,
      triggerType: JOB_TRIGGER_TYPE.CRON,
    });
    expect(logger.log).toHaveBeenCalledWith(
      'Attachment cleanup enqueued',
      expect.objectContaining({
        category: LOG_CATEGORY.SCHEDULED_TASK,
        context: { jobId: 'job-id' },
      }),
    );
  });

  it('skips submission when an active or pending cleanup job exists', async () => {
    const jobService = {
      submitExclusive: vi
        .fn()
        .mockRejectedValue(
          new ErrorException(ErrorExceptionCode.JOB_ALREADY_RUNNING),
        ),
    };
    const logger = { log: vi.fn() };
    const scheduler = new CleanupAttachmentsScheduler(
      jobService as unknown as JobService,
      logger as never,
    );

    await scheduler.handleCleanup();

    expect(logger.log).toHaveBeenCalledWith(
      'Attachment cleanup enqueue skipped',
      expect.objectContaining({
        category: LOG_CATEGORY.SCHEDULED_TASK,
      }),
    );
  });
});
