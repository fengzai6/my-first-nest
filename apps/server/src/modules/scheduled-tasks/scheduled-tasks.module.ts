import { LogModule } from '@/shared/log/log.module';
import { JobsModule } from '@/shared/jobs/jobs.module';
import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { CleanupExpiredLogsScheduler } from './cleanup-expired-logs.scheduler';
import { CleanupExpiredRefreshTokensScheduler } from './cleanup-expired-refresh-tokens.scheduler';
import { CleanupAttachmentsScheduler } from './cleanup-attachments.scheduler';
import { HeartbeatScheduler } from './heartbeat.scheduler';

@Module({
  imports: [ScheduleModule.forRoot(), JobsModule, LogModule],
  providers: [
    HeartbeatScheduler,
    CleanupExpiredRefreshTokensScheduler,
    CleanupExpiredLogsScheduler,
    CleanupAttachmentsScheduler,
  ],
})
export class ScheduledTasksModule {}
