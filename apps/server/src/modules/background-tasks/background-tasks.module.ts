import { AuthModule } from '@/modules/auth/auth.module';
import { AttachmentsModule } from '@/modules/attachments/attachments.module';
import { AttachmentsManagementPermissionGuard } from '@/modules/attachments/attachments-management-permission.guard';
import { PermissionsModule } from '@/modules/permissions/permissions.module';
import { JobsModule } from '@/shared/jobs/jobs.module';
import { Module } from '@nestjs/common';
import { BackgroundTasksController } from './background-tasks.controller';
import { CleanupExpiredRefreshTokensHandler } from './handlers/cleanup-expired-refresh-tokens.handler';
import { CleanupAttachmentsHandler } from './handlers/cleanup-attachments.handler';
import { ExportReportHandler } from './handlers/export-report.handler';
import { FlakyRetryHandler } from './handlers/flaky-retry.handler';

@Module({
  imports: [JobsModule, AuthModule, AttachmentsModule, PermissionsModule],
  controllers: [BackgroundTasksController],
  providers: [
    AttachmentsManagementPermissionGuard,
    ExportReportHandler,
    FlakyRetryHandler,
    CleanupExpiredRefreshTokensHandler,
    CleanupAttachmentsHandler,
  ],
})
export class BackgroundTasksModule {}
