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
    let scannedCount = 0;
    let deletedMetadataCount = 0;
    let missingFileCount = 0;
    let failedCount = 0;
    let rounds = 0;
    let reachedSafetyLimit = false;
    let deletedCursor: string | null = null;
    let orphanCursor: string | null = null;

    while (rounds < this.maxRounds) {
      rounds += 1;

      const deletedCandidates = await this.findDeletedCandidates(
        cutoff,
        deletedCursor,
      );
      const orphanCandidates = await this.findOrphanCandidates(
        cutoff,
        orphanCursor,
      );

      if (deletedCandidates.length === 0 && orphanCandidates.length === 0) {
        break;
      }

      const lastDeleted = deletedCandidates.at(-1);
      const lastOrphan = orphanCandidates.at(-1);
      if (lastDeleted) {
        deletedCursor = lastDeleted.id;
      }
      if (lastOrphan) {
        orphanCursor = lastOrphan.id;
      }

      const candidates = [...deletedCandidates, ...orphanCandidates];
      scannedCount += candidates.length;

      for (const attachment of candidates) {
        const outcome = await this.cleanupAttachment(attachment, cutoff);
        if (outcome.deleted) deletedMetadataCount += 1;
        if (outcome.missing) missingFileCount += 1;
        if (outcome.failed) {
          failedCount += 1;
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
    cursor: string | null,
  ): Promise<Attachment[]> {
    const query = this.attachmentRepository
      .createQueryBuilder('attachment')
      .withDeleted()
      .where('attachment.deletedAt IS NOT NULL')
      .andWhere('attachment.deletedAt <= :cutoff', { cutoff })
      .orderBy('attachment.id', 'ASC')
      .take(this.batchSize);

    if (cursor) {
      query.andWhere('attachment.id > :id', { id: cursor });
    }

    return query.getMany();
  }

  private async findOrphanCandidates(
    cutoff: Date,
    cursor: string | null,
  ): Promise<Attachment[]> {
    const query = this.attachmentRepository
      .createQueryBuilder('attachment')
      .where('attachment.bizType IS NULL')
      .andWhere('attachment.bizId IS NULL')
      .andWhere('attachment.deletedAt IS NULL')
      .andWhere('attachment.createdAt <= :cutoff', { cutoff })
      .orderBy('attachment.id', 'ASC')
      .take(this.batchSize);

    if (cursor) {
      query.andWhere('attachment.id > :id', { id: cursor });
    }

    return query.getMany();
  }

  private async cleanupAttachment(
    attachment: Attachment,
    cutoff: Date,
  ): Promise<{
    deleted: boolean;
    missing: boolean;
    failed: boolean;
  }> {
    try {
      const claimed = await this.attachmentRepository.manager.transaction(
        async (manager) => {
          const repository = manager.getRepository(Attachment);
          const locked = await repository.findOne({
            where: { id: attachment.id },
            withDeleted: true,
            lock: { mode: 'pessimistic_write' },
          });

          if (!locked) {
            return null;
          }

          if (!this.isCleanupCandidate(locked, cutoff)) {
            return null;
          }

          if (!locked.deletedAt) {
            await repository.update(locked.id, { deletedAt: cutoff });
          }

          return locked;
        },
      );

      if (!claimed) {
        return {
          deleted: false,
          missing: false,
          failed: false,
        };
      }

      const fileRemoved = await this.storage.remove(claimed.storageKey);
      const result = await this.attachmentRepository.delete(claimed.id);

      return {
        deleted: Boolean(result.affected),
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

  private isCleanupCandidate(attachment: Attachment, cutoff: Date) {
    if (attachment.deletedAt) {
      return attachment.deletedAt <= cutoff;
    }

    return (
      !attachment.bizType && !attachment.bizId && attachment.createdAt <= cutoff
    );
  }
}
