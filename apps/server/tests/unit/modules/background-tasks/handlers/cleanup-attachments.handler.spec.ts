import { CleanupAttachmentsHandler } from '@/modules/background-tasks/handlers/cleanup-attachments.handler';
import { AttachmentsService } from '@/modules/attachments/attachments.service';
import { JOB_NAMES } from '@/shared/jobs/constants/job.constants';
import { JobRegistryService } from '@/shared/jobs/registry/job-registry.service';
import { IJobContext } from '@/shared/jobs/types/job.types';
import { describe, expect, it, vi } from 'vitest';

describe('CleanupAttachmentsHandler', () => {
  it('registers and delegates cleanup to AttachmentsService', async () => {
    const register = vi.fn();
    const cleanupResult = {
      deletedMetadataCount: 2,
      missingFileCount: 1,
      failedCount: 0,
      scannedCount: 3,
      reachedSafetyLimit: false,
    };
    const cleanupExpiredAttachments = vi.fn().mockResolvedValue(cleanupResult);
    const handler = new CleanupAttachmentsHandler(
      { register } as unknown as JobRegistryService,
      { cleanupExpiredAttachments } as unknown as AttachmentsService,
    );

    expect(register).toHaveBeenCalledWith(handler);
    expect(handler.name).toBe(JOB_NAMES.CLEANUP_ATTACHMENTS);

    const updateProgress = vi.fn().mockResolvedValue(undefined);
    const ctx: IJobContext<Record<string, never>> = {
      jobId: 'job-id',
      name: JOB_NAMES.CLEANUP_ATTACHMENTS,
      payload: {},
      attemptsMade: 1,
      maxAttempts: 3,
      updateProgress,
    };
    const result = await handler.handle(ctx);

    expect(updateProgress).toHaveBeenCalledWith(10);
    expect(cleanupExpiredAttachments).toHaveBeenCalledTimes(1);
    expect(updateProgress).toHaveBeenCalledWith(100);
    expect(result).toEqual(cleanupResult);
  });

  it('rejects the job when cleanup has failed attachments', async () => {
    const cleanupResult = {
      deletedMetadataCount: 1,
      missingFileCount: 0,
      failedCount: 1,
      scannedCount: 2,
      reachedSafetyLimit: false,
    };
    const cleanupExpiredAttachments = vi.fn().mockResolvedValue(cleanupResult);
    const handler = new CleanupAttachmentsHandler(
      { register: vi.fn() } as unknown as JobRegistryService,
      { cleanupExpiredAttachments } as unknown as AttachmentsService,
    );
    const ctx: IJobContext<Record<string, never>> = {
      jobId: 'job-id',
      name: JOB_NAMES.CLEANUP_ATTACHMENTS,
      payload: {},
      attemptsMade: 1,
      maxAttempts: 3,
      updateProgress: vi.fn().mockResolvedValue(undefined),
    };

    await expect(handler.handle(ctx)).rejects.toThrow(
      '附件清理存在 1 条失败记录',
    );
  });
});
