import { AuthModule } from '@/modules/auth/auth.module';
import { JobsModule } from '@/shared/jobs/jobs.module';
import { Module } from '@nestjs/common';
import { BackgroundTasksController } from './background-tasks.controller';
import { CleanupExpiredRefreshTokensHandler } from './handlers/cleanup-expired-refresh-tokens.handler';
import { ExportReportHandler } from './handlers/export-report.handler';
import { FlakyRetryHandler } from './handlers/flaky-retry.handler';

@Module({
  imports: [JobsModule, AuthModule],
  controllers: [BackgroundTasksController],
  providers: [
    ExportReportHandler,
    FlakyRetryHandler,
    CleanupExpiredRefreshTokensHandler,
  ],
})
export class BackgroundTasksModule {}
