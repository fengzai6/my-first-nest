import { AttachmentCleanupService } from '@/modules/attachments/services/attachment-cleanup.service';
import { ATTACHMENT_BIZ_TYPE } from '@/modules/attachments/constants/attachment.constants';
import { Attachment } from '@/modules/attachments/entities/attachment.entity';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type MockQueryBuilder = {
  withDeleted: ReturnType<typeof vi.fn>;
  where: ReturnType<typeof vi.fn>;
  andWhere: ReturnType<typeof vi.fn>;
  orderBy: ReturnType<typeof vi.fn>;
  addOrderBy: ReturnType<typeof vi.fn>;
  take: ReturnType<typeof vi.fn>;
  getMany: ReturnType<typeof vi.fn>;
};

const createAttachment = (overrides: Partial<Attachment> = {}): Attachment => {
  const attachment = new Attachment();
  attachment.id = 'attachment-id';
  attachment.storageKey = '2026/09/image.png';
  attachment.bizType = null;
  attachment.bizId = null;
  attachment.createdAt = new Date('2026-09-01T00:00:00.000Z');
  attachment.deletedAt = new Date('2026-09-01T00:00:00.000Z');
  Object.assign(attachment, overrides);
  return attachment;
};

const createConfigService = ({
  cleanupRetentionDays = 7,
  cleanupBatchSize = 100,
}: {
  cleanupRetentionDays?: number;
  cleanupBatchSize?: number;
} = {}) =>
  ({
    get: vi.fn((key: string) =>
      key === 'default'
        ? {
            upload: {
              cleanupRetentionDays,
              cleanupBatchSize,
            },
          }
        : {},
    ),
  }) as unknown as ConfigService;

const createService = ({
  batchSize = 100,
  Service = AttachmentCleanupService,
}: {
  batchSize?: number;
  Service?: typeof AttachmentCleanupService;
} = {}) => {
  const queryBuilder: MockQueryBuilder = {
    withDeleted: vi.fn(),
    where: vi.fn(),
    andWhere: vi.fn(),
    orderBy: vi.fn(),
    addOrderBy: vi.fn(),
    take: vi.fn(),
    getMany: vi.fn(),
  };
  queryBuilder.withDeleted.mockReturnValue(queryBuilder);
  queryBuilder.where.mockReturnValue(queryBuilder);
  queryBuilder.andWhere.mockReturnValue(queryBuilder);
  queryBuilder.orderBy.mockReturnValue(queryBuilder);
  queryBuilder.addOrderBy.mockReturnValue(queryBuilder);
  queryBuilder.take.mockReturnValue(queryBuilder);

  const transactionRepository = {
    findOne: vi.fn().mockResolvedValue(null),
    delete: vi.fn().mockResolvedValue({ affected: 1 }),
  };
  const manager = {
    getRepository: vi.fn(() => transactionRepository),
  };
  const repository = {
    createQueryBuilder: vi.fn(() => queryBuilder),
    manager: {
      transaction: vi.fn(
        (callback: (entityManager: typeof manager) => Promise<unknown>) =>
          callback(manager),
      ),
    },
  };
  const storage = {
    remove: vi.fn(),
    save: vi.fn(),
    read: vi.fn(),
    cleanup: vi.fn(),
  };

  const service = new Service(
    repository as unknown as Repository<Attachment>,
    storage,
    createConfigService({
      cleanupRetentionDays: 7,
      cleanupBatchSize: batchSize,
    }),
  );

  return {
    service,
    storage,
    repository,
    queryBuilder,
    transactionRepository,
  };
};

describe('AttachmentCleanupService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deletes a soft-deleted attachment after the retention period', async () => {
    const { service, storage, queryBuilder, transactionRepository } =
      createService();
    const attachment = createAttachment({
      id: 'deleted-id',
      storageKey: '2026/09/deleted.png',
      deletedAt: new Date('2026-09-01T00:00:00.000Z'),
    });

    queryBuilder.getMany
      .mockResolvedValueOnce([attachment])
      .mockResolvedValueOnce([]);
    transactionRepository.findOne.mockResolvedValue(attachment);
    storage.remove.mockResolvedValue(true);

    const result = await service.cleanupExpiredAttachments(
      new Date('2026-09-16T03:00:00.000Z'),
    );

    expect(storage.remove).toHaveBeenCalledWith('2026/09/deleted.png');
    expect(transactionRepository.findOne).toHaveBeenCalledWith({
      where: { id: 'deleted-id' },
      withDeleted: true,
      lock: { mode: 'pessimistic_write' },
    });
    expect(transactionRepository.delete).toHaveBeenCalledWith('deleted-id');
    expect(result).toEqual({
      deletedMetadataCount: 1,
      missingFileCount: 0,
      failedCount: 0,
      scannedCount: 1,
      reachedSafetyLimit: false,
    });
  });

  it('deletes metadata when the physical file is already missing', async () => {
    const { service, storage, queryBuilder, transactionRepository } =
      createService();
    const attachment = createAttachment({ deletedAt: undefined });
    queryBuilder.getMany
      .mockResolvedValueOnce([attachment])
      .mockResolvedValueOnce([]);
    transactionRepository.findOne.mockResolvedValue(attachment);
    storage.remove.mockResolvedValue(false);

    const result = await service.cleanupExpiredAttachments(
      new Date('2026-09-16T03:00:00.000Z'),
    );

    expect(transactionRepository.delete).toHaveBeenCalledWith('attachment-id');
    expect(result.missingFileCount).toBe(1);
    expect(result.deletedMetadataCount).toBe(1);
  });

  it('treats an already deleted metadata row as idempotent success', async () => {
    const { service, storage, queryBuilder } = createService();
    queryBuilder.getMany
      .mockResolvedValueOnce([createAttachment()])
      .mockResolvedValueOnce([]);
    storage.remove.mockResolvedValue(true);

    const result = await service.cleanupExpiredAttachments(
      new Date('2026-09-16T03:00:00.000Z'),
    );

    expect(result.deletedMetadataCount).toBe(1);
    expect(result.failedCount).toBe(0);
    expect(storage.remove).not.toHaveBeenCalled();
  });

  it('does not remove the file when the attachment is bound before cleanup', async () => {
    const { service, storage, queryBuilder, transactionRepository } =
      createService();
    const attachment = createAttachment({ deletedAt: undefined });
    queryBuilder.getMany
      .mockResolvedValueOnce([attachment])
      .mockResolvedValueOnce([]);
    transactionRepository.findOne.mockResolvedValue(
      createAttachment({
        deletedAt: undefined,
        bizType: ATTACHMENT_BIZ_TYPE.DOCUMENT,
        bizId: 'document-id',
      }),
    );

    const result = await service.cleanupExpiredAttachments(
      new Date('2026-09-16T03:00:00.000Z'),
    );

    expect(storage.remove).not.toHaveBeenCalled();
    expect(result.failedCount).toBe(0);
    expect(result.deletedMetadataCount).toBe(0);
  });

  it('keeps metadata and continues when one attachment fails', async () => {
    const { service, storage, queryBuilder, transactionRepository } =
      createService();
    const failed = createAttachment({ id: 'failed-id' });
    const success = createAttachment({ id: 'success-id' });

    queryBuilder.getMany
      .mockResolvedValueOnce([failed, success])
      .mockResolvedValueOnce([]);
    transactionRepository.findOne
      .mockResolvedValueOnce(failed)
      .mockResolvedValueOnce(success);
    storage.remove
      .mockRejectedValueOnce(new Error('disk unavailable'))
      .mockResolvedValueOnce(true);

    const result = await service.cleanupExpiredAttachments(
      new Date('2026-09-16T03:00:00.000Z'),
    );

    expect(transactionRepository.delete).toHaveBeenCalledTimes(1);
    expect(transactionRepository.delete).toHaveBeenCalledWith('success-id');
    expect(result.failedCount).toBe(1);
    expect(result.deletedMetadataCount).toBe(1);
  });

  it('excludes failed records from subsequent rounds', async () => {
    const { service, storage, queryBuilder, transactionRepository } =
      createService({
        batchSize: 1,
        Service: class extends AttachmentCleanupService {
          protected readonly maxRounds = 2;
        },
      });
    const failed = createAttachment({ id: 'failed-id' });
    const success = createAttachment({ id: 'success-id' });

    queryBuilder.getMany
      .mockResolvedValueOnce([failed])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([success])
      .mockResolvedValueOnce([]);
    transactionRepository.findOne
      .mockResolvedValueOnce(failed)
      .mockResolvedValueOnce(success);
    storage.remove
      .mockRejectedValueOnce(new Error('disk unavailable'))
      .mockResolvedValueOnce(true);

    await service.cleanupExpiredAttachments(
      new Date('2026-09-16T03:00:00.000Z'),
    );

    expect(transactionRepository.delete).toHaveBeenCalledWith('success-id');
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'attachment.id NOT IN (:...excludedIds)',
      { excludedIds: ['failed-id'] },
    );
  });

  it('keeps querying until both candidate types return less than a full batch', async () => {
    const { service, queryBuilder } = createService({ batchSize: 2 });

    queryBuilder.getMany
      .mockResolvedValueOnce([
        createAttachment({ id: 'deleted-1' }),
        createAttachment({ id: 'deleted-2' }),
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([createAttachment({ id: 'deleted-3' })])
      .mockResolvedValueOnce([]);

    const result = await service.cleanupExpiredAttachments(
      new Date('2026-09-16T03:00:00.000Z'),
    );

    expect(result.scannedCount).toBe(3);
    expect(queryBuilder.getMany).toHaveBeenCalledTimes(4);
  });

  it('sets reachedSafetyLimit when the safety round cap is reached', async () => {
    const { service, queryBuilder } = createService({
      batchSize: 1,
      Service: class extends AttachmentCleanupService {
        protected readonly maxRounds = 2;
      },
    });

    queryBuilder.getMany.mockResolvedValue([createAttachment()]);

    const result = await service.cleanupExpiredAttachments(
      new Date('2026-09-16T03:00:00.000Z'),
    );

    expect(result.reachedSafetyLimit).toBe(true);
  });

  it('queries orphan candidates only when the attachment was never bound', async () => {
    const { service, queryBuilder } = createService();

    queryBuilder.getMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    await service.cleanupExpiredAttachments(
      new Date('2026-09-16T03:00:00.000Z'),
    );

    expect(queryBuilder.where).toHaveBeenCalledWith(
      'attachment.bizType IS NULL',
    );
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'attachment.bizId IS NULL',
    );
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'attachment.deletedAt IS NULL',
    );
    expect(queryBuilder.andWhere).not.toHaveBeenCalledWith(
      expect.stringContaining(ATTACHMENT_BIZ_TYPE.DOCUMENT),
    );
  });
});
