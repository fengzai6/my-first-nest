import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

/**
 * 轻量进程内定时任务。
 * 仅用于对比 @nestjs/schedule 与 BullMQ 任务系统，不写入 job_runs。
 */
@Injectable()
export class HeartbeatScheduler {
  private readonly logger = new Logger(HeartbeatScheduler.name);

  @Cron(CronExpression.EVERY_MINUTE)
  handleHeartbeat() {
    this.logger.log(
      `[scheduled-tasks] heartbeat pid=${process.pid} at=${new Date().toISOString()}`,
    );
  }
}
