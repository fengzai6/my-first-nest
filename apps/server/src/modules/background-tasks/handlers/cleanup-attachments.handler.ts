import { AttachmentsService } from '@/modules/attachments/attachments.service';
import { ICleanupAttachmentsResult } from '@/modules/attachments/services/attachment-cleanup.service';
import { JOB_NAMES } from '@/shared/jobs/constants/job.constants';
import { JobRegistryService } from '@/shared/jobs/registry/job-registry.service';
import { IJobContext, IJobHandler } from '@/shared/jobs/types/job.types';
import { Injectable } from '@nestjs/common';

@Injectable()
export class CleanupAttachmentsHandler implements IJobHandler<
  Record<string, never>,
  ICleanupAttachmentsResult
> {
  readonly name = JOB_NAMES.CLEANUP_ATTACHMENTS;

  constructor(
    registry: JobRegistryService,
    private readonly attachmentsService: AttachmentsService,
  ) {
    registry.register(this);
  }

  async handle(
    ctx: IJobContext<Record<string, never>>,
  ): Promise<ICleanupAttachmentsResult> {
    await ctx.updateProgress(10);
    const result = await this.attachmentsService.cleanupExpiredAttachments();
    if (result.failedCount > 0) {
      throw new Error(`附件清理存在 ${result.failedCount} 条失败记录`);
    }
    await ctx.updateProgress(100);
    return result;
  }
}
