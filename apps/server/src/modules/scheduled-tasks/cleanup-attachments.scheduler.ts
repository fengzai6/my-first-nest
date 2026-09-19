import {
  JOB_NAMES,
  JOB_TRIGGER_TYPE,
} from '@/shared/jobs/constants/job.constants';
import { JobService } from '@/shared/jobs/services/job.service';
import { LOG_CATEGORY } from '@/shared/log/constants/log.constants';
import { LoggerService } from '@/shared/log/logger.service';
import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class CleanupAttachmentsScheduler {
  constructor(
    private readonly jobService: JobService,
    private readonly logger: LoggerService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async handleCleanup() {
    const hasActiveOrPending = await this.jobService.hasActiveOrPending(
      JOB_NAMES.CLEANUP_ATTACHMENTS,
    );

    if (hasActiveOrPending) {
      this.logger.log('Attachment cleanup enqueue skipped', {
        category: LOG_CATEGORY.SCHEDULED_TASK,
        context: {
          name: JOB_NAMES.CLEANUP_ATTACHMENTS,
          reason: 'active-or-pending',
        },
      });
      return;
    }

    const job = await this.jobService.submit({
      name: JOB_NAMES.CLEANUP_ATTACHMENTS,
      payload: {},
      attempts: 3,
      backoffMs: 2000,
      triggerType: JOB_TRIGGER_TYPE.CRON,
    });

    this.logger.log('Attachment cleanup enqueued', {
      category: LOG_CATEGORY.SCHEDULED_TASK,
      context: { jobId: job.id },
    });
  }
}
