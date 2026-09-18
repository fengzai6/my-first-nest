import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { getConfig } from '@/config/configuration';
import { AttachmentSignatureService } from './attachment-signature.service';
import { AttachmentsController } from './attachments.controller';
import { AttachmentsManagementController } from './attachments-management.controller';
import { AttachmentsManagementPermissionGuard } from './attachments-management-permission.guard';
import { AttachmentsService } from './attachments.service';
import { Attachment } from './entities/attachment.entity';
import { ATTACHMENT_STORAGE } from './interfaces/attachment-storage.interface';
import { LocalAttachmentStorageService } from './services/local-attachment-storage.service';
import { AttachmentCleanupService } from './services/attachment-cleanup.service';
import { AttachmentManagementService } from './services/attachment-management.service';
import { PermissionsModule } from '../permissions/permissions.module';

@Module({
  imports: [TypeOrmModule.forFeature([Attachment]), PermissionsModule],
  controllers: [AttachmentsController, AttachmentsManagementController],
  providers: [
    AttachmentsService,
    AttachmentCleanupService,
    AttachmentManagementService,
    AttachmentsManagementPermissionGuard,
    {
      provide: AttachmentSignatureService,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) =>
        new AttachmentSignatureService(getConfig(configService)),
    },
    {
      provide: ATTACHMENT_STORAGE,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) =>
        new LocalAttachmentStorageService(getConfig(configService)),
    },
  ],
  exports: [
    AttachmentsService,
    AttachmentManagementService,
    AttachmentsManagementPermissionGuard,
  ],
})
export class AttachmentsModule {}
