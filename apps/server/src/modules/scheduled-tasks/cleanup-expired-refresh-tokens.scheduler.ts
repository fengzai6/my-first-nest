import {
  JOB_NAMES,
  JOB_TRIGGER_TYPE,
} from '@/shared/jobs/constants/job.constants';
import { JobService } from '@/shared/jobs/services/job.service';
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

/**
 * 每天凌晨清理过期 refresh token。
 * 通过 JobService 入队，执行记录进入 job_runs，便于二期前端查询。
 */
@Injectable()
export class CleanupExpiredRefreshTokensScheduler {
  private readonly logger = new Logger(
    CleanupExpiredRefreshTokensScheduler.name,
  );

  constructor(private readonly jobService: JobService) {}

  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async handleCleanup() {
    const job = await this.jobService.submit({
      name: JOB_NAMES.CLEANUP_EXPIRED_REFRESH_TOKENS,
      payload: {},
      attempts: 3,
      backoffMs: 2000,
      triggerType: JOB_TRIGGER_TYPE.CRON,
    });

    this.logger.log(
      `[scheduled-tasks] enqueued cleanup-expired-refresh-tokens jobId=${job.id}`,
    );
  }
}
