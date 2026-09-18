import { AttachmentExceptionCode } from '@/common/exceptions/attachment.exception';
import { BackgroundTasksController } from '@/modules/background-tasks/background-tasks.controller';
import { JOB_NAMES } from '@/shared/jobs/constants/job.constants';
import { describe, expect, it, vi } from 'vitest';

describe('BackgroundTasksController cleanup-attachments', () => {
  it('rejects a duplicate cleanup request', async () => {
    const jobService = {
      hasActiveOrPending: vi.fn().mockResolvedValue(true),
      submit: vi.fn(),
    };
    const controller = new BackgroundTasksController(jobService as never);

    await expect(
      controller.cleanupAttachments({ id: 'admin-id' } as never),
    ).rejects.toMatchObject({
      code: AttachmentExceptionCode.CLEANUP_ALREADY_RUNNING,
    });
    expect(jobService.submit).not.toHaveBeenCalled();
  });

  it('submits cleanup with the authenticated user', async () => {
    const jobService = {
      hasActiveOrPending: vi.fn().mockResolvedValue(false),
      submit: vi.fn().mockResolvedValue({ id: 'job-id' }),
    };
    const controller = new BackgroundTasksController(jobService as never);

    await expect(
      controller.cleanupAttachments({ id: 'admin-id' } as never),
    ).resolves.toEqual({ id: 'job-id' });
    expect(jobService.submit).toHaveBeenCalledWith({
      name: JOB_NAMES.CLEANUP_ATTACHMENTS,
      payload: {},
      attempts: 3,
      backoffMs: 2000,
      triggerType: 'manual',
      createdBy: 'admin-id',
    });
  });
});
