import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { getConfig } from '@/config/configuration';
import { AttachmentSignatureService } from './attachment-signature.service';
import { AttachmentsController } from './attachments.controller';
import { AttachmentsService } from './attachments.service';
import { Attachment } from './entities/attachment.entity';
import { ATTACHMENT_STORAGE } from './interfaces/attachment-storage.interface';
import { LocalAttachmentStorageService } from './services/local-attachment-storage.service';

@Module({
  imports: [TypeOrmModule.forFeature([Attachment])],
  controllers: [AttachmentsController],
  providers: [
    AttachmentsService,
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
  exports: [AttachmentsService],
})
export class AttachmentsModule {}
