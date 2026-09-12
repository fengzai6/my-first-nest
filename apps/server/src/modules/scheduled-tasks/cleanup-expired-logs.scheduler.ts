import { getConfig } from '@/config/configuration';
import { LOG_CATEGORY } from '@/shared/log/constants/log.constants';
import { LogService } from '@/shared/log/log.service';
import { LoggerService } from '@/shared/log/logger.service';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class CleanupExpiredLogsScheduler {
  private readonly retentionDays: number;

  constructor(
    private readonly logs: LogService,
    configService: ConfigService,
    private readonly logger: LoggerService,
  ) {
    this.retentionDays = getConfig(configService).log.retentionDays;
  }

  // NOTE: now 参数只供测试注入固定时间，@Cron 触发时不传。
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async handleCleanup(now = new Date()): Promise<void> {
    const timestamp = new Date(
      now.getTime() - this.retentionDays * 24 * 60 * 60 * 1000,
    );
    const deleted = await this.logs.purgeBefore(timestamp);

    this.logger.log('Expired logs removed', {
      category: LOG_CATEGORY.SCHEDULED_TASK,
      context: { deleted },
    });
  }
}
