import { getConfig } from '@/config/configuration';
import {
  AttachmentException,
  AttachmentExceptionCode,
} from '@/common/exceptions/attachment.exception';
import {
  ErrorException,
  ErrorExceptionCode,
} from '@/common/exceptions/error.exception';
import { LoggerService } from '@/shared/log/logger.service';
import { LOG_CATEGORY } from '@/shared/log/constants/log.constants';
import {
  JOB_NAMES,
  JOB_TRIGGER_TYPE,
} from '@/shared/jobs/constants/job.constants';
import { JobService } from '@/shared/jobs/services/job.service';
import type { IJobRunView } from '@/shared/jobs/types/job.types';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '@/modules/users/entities/user.entity';
import { AttachmentSignatureService } from '../attachment-signature.service';
import { AttachmentVisibility } from '../constants/attachment.constants';
import { FindManagementAttachmentsDto } from '../dto/find-management-attachments.dto';
import { Attachment } from '../entities/attachment.entity';

export type AttachmentManagementStatus = 'bound' | 'orphan' | 'deleted';
export type AttachmentCleanupStatus = 'not_candidate' | 'waiting' | 'eligible';

export interface IAttachmentManagementItem {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
  visibility: AttachmentVisibility;
  storageProvider: string;
  bizType: string | null;
  bizId: string | null;
  uploadedBy: { id: string; displayName: string };
  status: AttachmentManagementStatus;
  cleanupStatus: AttachmentCleanupStatus;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface IAttachmentManagementPage {
  list: IAttachmentManagementItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface IAttachmentManagementDetail extends IAttachmentManagementItem {
  retentionDeadline: Date | null;
}

export interface IAttachmentBulkResult {
  succeeded: string[];
  failed: { id: string; reason: string }[];
}

@Injectable()
export class AttachmentManagementService {
  private readonly retentionDays: number;

  constructor(
    @InjectRepository(Attachment)
    private readonly attachmentRepository: Repository<Attachment>,
    private readonly signatureService: AttachmentSignatureService,
    private readonly jobService: JobService,
    configService: ConfigService,
    private readonly logger: LoggerService,
  ) {
    this.retentionDays = getConfig(configService).upload.cleanupRetentionDays;
  }

  async findAll(
    query: FindManagementAttachmentsDto,
    now = new Date(),
  ): Promise<IAttachmentManagementPage> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const cutoff = new Date(
      now.getTime() - this.retentionDays * 24 * 60 * 60 * 1000,
    );
    const builder = this.attachmentRepository
      .createQueryBuilder('attachment')
      .leftJoinAndSelect('attachment.uploadedBy', 'uploadedBy');

    if (!query.orphanOnly && query.includeDeleted) {
      builder.withDeleted();
    }
    if (query.orphanOnly) {
      builder
        .andWhere('attachment.bizType IS NULL')
        .andWhere('attachment.bizId IS NULL')
        .andWhere('attachment.deletedAt IS NULL');
    }
    if (query.keyword) {
      builder.andWhere('attachment.originalName ILIKE :keyword', {
        keyword: `%${query.keyword}%`,
      });
    }
    if (query.mimeType) {
      builder.andWhere('attachment.mimeType = :mimeType', {
        mimeType: query.mimeType,
      });
    }
    if (query.visibility) {
      builder.andWhere('attachment.visibility = :visibility', {
        visibility: query.visibility,
      });
    }
    if (query.bizType) {
      builder.andWhere('attachment.bizType = :bizType', {
        bizType: query.bizType,
      });
    }
    if (query.bizId) {
      builder.andWhere('attachment.bizId = :bizId', {
        bizId: query.bizId,
      });
    }
    if (query.uploader) {
      builder.andWhere(
        '(uploadedBy.username ILIKE :uploader OR uploadedBy.displayName ILIKE :uploader)',
        { uploader: `%${query.uploader}%` },
      );
    }
    if (query.createdFrom) {
      builder.andWhere('attachment.createdAt >= :createdFrom', {
        createdFrom: query.createdFrom,
      });
    }
    if (query.createdTo) {
      builder.andWhere('attachment.createdAt <= :createdTo', {
        createdTo: query.createdTo,
      });
    }

    const [items, total] = await builder
      .orderBy('attachment.createdAt', 'DESC')
      .addOrderBy('attachment.id', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    return {
      list: items.map((item) => this.toManagementItem(item, cutoff)),
      total,
      page,
      pageSize,
    };
  }

  async findOne(id: string): Promise<IAttachmentManagementDetail> {
    const attachment = await this.attachmentRepository.findOne({
      where: { id },
      relations: { uploadedBy: true },
      withDeleted: true,
    });

    if (!attachment) {
      throw new AttachmentException(AttachmentExceptionCode.NOT_FOUND);
    }

    return {
      ...this.toManagementItem(attachment, this.getRetentionCutoff()),
      retentionDeadline: this.getRetentionDeadline(attachment),
    };
  }

  async createSignedUrl(
    id: string,
    user: User,
  ): Promise<{ url: string; expiresAt: number }> {
    await this.findOne(id);
    return this.signatureService.createSignedUrl(id, user.id, 'admin');
  }

  async updateVisibility(
    id: string,
    visibility: AttachmentVisibility,
  ): Promise<IAttachmentManagementItem> {
    const attachment = await this.getMutableAttachment(id);
    const before = attachment.visibility;
    attachment.visibility = visibility;
    const saved = await this.attachmentRepository.save(attachment);

    this.logger.log('Attachment visibility updated', {
      category: LOG_CATEGORY.BUSINESS,
      context: { attachmentId: id, before, after: visibility },
    });

    return this.toManagementItem(saved, this.getRetentionCutoff());
  }

  async softDelete(id: string): Promise<void> {
    const attachment = await this.getMutableAttachment(id);
    await this.attachmentRepository.softRemove(attachment);

    this.logger.log('Attachment soft deleted from management center', {
      category: LOG_CATEGORY.BUSINESS,
      context: { attachmentId: id },
    });
  }

  async bulkUpdateVisibility(
    ids: string[],
    visibility: AttachmentVisibility,
  ): Promise<IAttachmentBulkResult> {
    return this.runBulk(ids, (id) => this.updateVisibility(id, visibility));
  }

  async bulkSoftDelete(ids: string[]): Promise<IAttachmentBulkResult> {
    return this.runBulk(ids, (id) => this.softDelete(id));
  }

  async triggerCleanup(user: User): Promise<IJobRunView> {
    const job = await this.submitExclusiveCleanup(user);

    this.logger.log('Attachment cleanup triggered from management center', {
      category: LOG_CATEGORY.BUSINESS,
      context: { jobId: job.id },
    });

    return job;
  }

  private async submitExclusiveCleanup(user: User) {
    try {
      return await this.jobService.submitExclusive({
        name: JOB_NAMES.CLEANUP_ATTACHMENTS,
        payload: {},
        attempts: 3,
        backoffMs: 2000,
        triggerType: JOB_TRIGGER_TYPE.MANUAL,
        createdBy: user.id,
      });
    } catch (error) {
      if (
        error instanceof ErrorException &&
        'code' in error &&
        error.code === ErrorExceptionCode.JOB_ALREADY_RUNNING
      ) {
        throw new AttachmentException(
          AttachmentExceptionCode.CLEANUP_ALREADY_RUNNING,
        );
      }
      throw error;
    }
  }

  async getLatestCleanup(): Promise<IJobRunView | null> {
    const page = await this.jobService.list({
      name: JOB_NAMES.CLEANUP_ATTACHMENTS,
      page: 1,
      pageSize: 1,
    });

    return page.list[0] ?? null;
  }

  private async getMutableAttachment(id: string): Promise<Attachment> {
    const attachment = await this.attachmentRepository.findOne({
      where: { id },
      relations: { uploadedBy: true },
    });

    if (!attachment) {
      throw new AttachmentException(AttachmentExceptionCode.NOT_FOUND);
    }
    if (attachment.bizType || attachment.bizId) {
      throw new AttachmentException(AttachmentExceptionCode.IN_USE);
    }

    return attachment;
  }

  private async runBulk(
    ids: string[],
    action: (id: string) => Promise<unknown>,
  ): Promise<IAttachmentBulkResult> {
    const result: IAttachmentBulkResult = { succeeded: [], failed: [] };

    for (const id of ids) {
      try {
        await action(id);
        result.succeeded.push(id);
      } catch (error) {
        result.failed.push({
          id,
          reason: error instanceof Error ? error.message : '操作失败',
        });
      }
    }

    return result;
  }

  private getAttachmentStatus(
    attachment: Attachment,
  ): AttachmentManagementStatus {
    if (attachment.deletedAt) return 'deleted';
    if (attachment.bizType && attachment.bizId) return 'bound';
    return 'orphan';
  }

  private getCleanupStatus(
    attachment: Attachment,
    cutoff: Date,
  ): AttachmentCleanupStatus {
    if (attachment.bizType || attachment.bizId) return 'not_candidate';
    if (attachment.deletedAt) {
      return attachment.deletedAt <= cutoff ? 'eligible' : 'waiting';
    }
    return attachment.createdAt <= cutoff ? 'eligible' : 'waiting';
  }

  private getRetentionCutoff() {
    return new Date(Date.now() - this.retentionDays * 24 * 60 * 60 * 1000);
  }

  private getRetentionDeadline(attachment: Attachment): Date | null {
    const baseDate =
      attachment.deletedAt ??
      (attachment.bizType || attachment.bizId ? null : attachment.createdAt);
    if (!baseDate) return null;

    return new Date(
      baseDate.getTime() + this.retentionDays * 24 * 60 * 60 * 1000,
    );
  }

  private toManagementItem(
    attachment: Attachment,
    cutoff: Date,
  ): IAttachmentManagementItem {
    return {
      id: attachment.id,
      originalName: attachment.originalName,
      mimeType: attachment.mimeType,
      size: attachment.size,
      visibility: attachment.visibility,
      storageProvider: attachment.storageProvider,
      bizType: attachment.bizType,
      bizId: attachment.bizId,
      uploadedBy: {
        id: attachment.uploadedBy.id,
        displayName: attachment.uploadedBy.displayName,
      },
      status: this.getAttachmentStatus(attachment),
      cleanupStatus: this.getCleanupStatus(attachment, cutoff),
      createdAt: attachment.createdAt,
      updatedAt: attachment.updatedAt,
      deletedAt: attachment.deletedAt ?? null,
    };
  }
}
