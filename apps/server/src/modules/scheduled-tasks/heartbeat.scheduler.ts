import { LOG_CATEGORY } from '@/shared/log/constants/log.constants';
import { LoggerService } from '@/shared/log/logger.service';
import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

/**
 * 轻量进程内定时任务。
 * 仅用于对比 @nestjs/schedule 与 BullMQ 任务系统，不写入 job_runs。
 */
@Injectable()
export class HeartbeatScheduler {
  constructor(private readonly logger: LoggerService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  handleHeartbeat() {
    this.logger.log('Scheduled heartbeat', {
      category: LOG_CATEGORY.SCHEDULED_TASK,
      context: { pid: process.pid },
    });
  }
}
