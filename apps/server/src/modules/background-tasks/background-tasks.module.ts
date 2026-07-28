import { JobsModule } from '@/shared/jobs/jobs.module';
import { Module } from '@nestjs/common';
import { BackgroundTasksController } from './background-tasks.controller';
import { ExportReportHandler } from './handlers/export-report.handler';
import { FlakyRetryHandler } from './handlers/flaky-retry.handler';

@Module({
  imports: [JobsModule],
  controllers: [BackgroundTasksController],
  providers: [ExportReportHandler, FlakyRetryHandler],
})
export class BackgroundTasksModule {}
