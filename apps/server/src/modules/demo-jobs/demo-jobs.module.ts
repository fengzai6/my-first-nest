import { JobsModule } from '@/shared/jobs/jobs.module';
import { Module } from '@nestjs/common';
import { DemoJobsController } from './demo-jobs.controller';
import { ExportReportHandler } from './handlers/export-report.handler';
import { FlakyRetryHandler } from './handlers/flaky-retry.handler';

@Module({
  imports: [JobsModule],
  controllers: [DemoJobsController],
  providers: [ExportReportHandler, FlakyRetryHandler],
})
export class DemoJobsModule {}
