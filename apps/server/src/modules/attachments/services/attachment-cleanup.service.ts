import { getConfig } from '@/config/configuration';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Attachment } from '../entities/attachment.entity';
import {
  ATTACHMENT_STORAGE,
  IAttachmentStorage,
} from '../interfaces/attachment-storage.interface';

const CLEANUP_MAX_ROUNDS = 100;
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

export interface ICleanupAttachmentsResult {
  deletedMetadataCount: number;
  missingFileCount: number;
  failedCount: number;
  scannedCount: number;
  reachedSafetyLimit: boolean;
}

@Injectable()
export class AttachmentCleanupService {
  private readonly retentionDays: number;
  private readonly batchSize: number;
  protected readonly maxRounds: number = CLEANUP_MAX_ROUNDS;

  constructor(
    @InjectRepository(Attachment)
    private readonly attachmentRepository: Repository<Attachment>,
    @Inject(ATTACHMENT_STORAGE)
    private readonly storage: IAttachmentStorage,
    configService: ConfigService,
  ) {
    const config = getConfig(configService);
    this.retentionDays = config.upload.cleanupRetentionDays;
    this.batchSize = config.upload.cleanupBatchSize;
  }

  async cleanupExpiredAttachments(
    now?: Date,
  ): Promise<ICleanupAttachmentsResult> {
    const currentTime = now ?? new Date();
    const cutoff = new Date(
      currentTime.getTime() - this.retentionDays * MILLISECONDS_PER_DAY,
    );
    const failedIds = new Set<string>();
    let scannedCount = 0;
    let deletedMetadataCount = 0;
    let missingFileCount = 0;
    let failedCount = 0;
    let rounds = 0;
    let reachedSafetyLimit = false;

    while (rounds < this.maxRounds) {
      rounds += 1;

      const deletedCandidates = await this.findDeletedCandidates(cutoff, [
        ...failedIds,
      ]);
      const orphanCandidates = await this.findOrphanCandidates(cutoff, [
        ...failedIds,
      ]);

      if (deletedCandidates.length === 0 && orphanCandidates.length === 0) {
        break;
      }

      const candidates = [...deletedCandidates, ...orphanCandidates];
      scannedCount += candidates.length;

      for (const attachment of candidates) {
        const outcome = await this.cleanupAttachment(attachment);
        if (outcome.deleted) deletedMetadataCount += 1;
        if (outcome.missing) missingFileCount += 1;
        if (outcome.failed) {
          failedCount += 1;
          failedIds.add(attachment.id);
        }
      }

      const hasFullBatch =
        deletedCandidates.length >= this.batchSize ||
        orphanCandidates.length >= this.batchSize;

      if (!hasFullBatch) break;

      if (rounds === this.maxRounds) {
        reachedSafetyLimit = true;
      }
    }

    return {
      deletedMetadataCount,
      missingFileCount,
      failedCount,
      scannedCount,
      reachedSafetyLimit,
    };
  }

  private async findDeletedCandidates(
    cutoff: Date,
    excludedIds: string[],
  ): Promise<Attachment[]> {
    const query = this.attachmentRepository
      .createQueryBuilder('attachment')
      .withDeleted()
      .where('attachment.deletedAt IS NOT NULL')
      .andWhere('attachment.deletedAt <= :cutoff', { cutoff })
      .orderBy('attachment.createdAt', 'ASC')
      .addOrderBy('attachment.id', 'ASC')
      .take(this.batchSize);

    if (excludedIds.length > 0) {
      query.andWhere('attachment.id NOT IN (:...excludedIds)', {
        excludedIds,
      });
    }

    return query.getMany();
  }

  private async findOrphanCandidates(
    cutoff: Date,
    excludedIds: string[],
  ): Promise<Attachment[]> {
    const query = this.attachmentRepository
      .createQueryBuilder('attachment')
      .where('attachment.bizType IS NULL')
      .andWhere('attachment.bizId IS NULL')
      .andWhere('attachment.deletedAt IS NULL')
      .andWhere('attachment.createdAt <= :cutoff', { cutoff })
      .orderBy('attachment.createdAt', 'ASC')
      .addOrderBy('attachment.id', 'ASC')
      .take(this.batchSize);

    if (excludedIds.length > 0) {
      query.andWhere('attachment.id NOT IN (:...excludedIds)', {
        excludedIds,
      });
    }

    return query.getMany();
  }

  private async cleanupAttachment(attachment: Attachment): Promise<{
    deleted: boolean;
    missing: boolean;
    failed: boolean;
  }> {
    try {
      const fileRemoved = await this.storage.remove(attachment.storageKey);
      await this.attachmentRepository.delete(attachment.id);

      return {
        deleted: true,
        missing: !fileRemoved,
        failed: false,
      };
    } catch {
      return {
        deleted: false,
        missing: false,
        failed: true,
      };
    }
  }
}
