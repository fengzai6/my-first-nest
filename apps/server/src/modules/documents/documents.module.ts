import { AttachmentsModule } from '@/modules/attachments/attachments.module';
import { RolesModule } from '@/modules/roles/roles.module';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { Document } from './entities/document.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Document]),
    AttachmentsModule,
    RolesModule,
  ],
  controllers: [DocumentsController],
  providers: [DocumentsService],
  exports: [DocumentsService],
})
export class DocumentsModule {}
