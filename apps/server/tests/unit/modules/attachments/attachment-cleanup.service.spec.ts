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
    update: vi.fn().mockResolvedValue({ affected: 1 }),
    delete: vi.fn().mockResolvedValue({ affected: 1 }),
  };
  const manager = {
    getRepository: vi.fn(() => transactionRepository),
  };
  const repository = {
    createQueryBuilder: vi.fn(() => queryBuilder),
    delete: vi.fn().mockResolvedValue({ affected: 1 }),
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
    manager,
  };
};

describe('AttachmentCleanupService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deletes a soft-deleted attachment after the retention period', async () => {
    const {
      service,
      storage,
      queryBuilder,
      transactionRepository,
      repository,
    } = createService();
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
    expect(repository.delete).toHaveBeenCalledWith('deleted-id');
    expect(transactionRepository.update).not.toHaveBeenCalled();
    expect(result).toEqual({
      deletedMetadataCount: 1,
      missingFileCount: 0,
      failedCount: 0,
      scannedCount: 1,
      reachedSafetyLimit: false,
    });
  });

  it('persists an orphan cleanup claim before removing the file', async () => {
    const {
      service,
      storage,
      queryBuilder,
      transactionRepository,
      repository,
      manager,
    } = createService();
    const events: string[] = [];
    const attachment = createAttachment({ deletedAt: undefined });
    const cutoff = new Date('2026-09-09T03:00:00.000Z');

    repository.manager.transaction.mockImplementation(
      async (callback: (entityManager: typeof manager) => Promise<unknown>) => {
        const result = await callback(manager);
        events.push('transaction-committed');
        return result;
      },
    );
    storage.remove.mockImplementation(() => {
      events.push('file-removed');
      return Promise.resolve(true);
    });
    repository.delete.mockImplementation(() => {
      events.push('metadata-deleted');
      return Promise.resolve({ affected: 1 });
    });
    queryBuilder.getMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([attachment]);
    transactionRepository.findOne.mockResolvedValue(attachment);

    await service.cleanupExpiredAttachments(
      new Date('2026-09-16T03:00:00.000Z'),
    );

    expect(transactionRepository.update).toHaveBeenCalledWith(attachment.id, {
      deletedAt: cutoff,
    });
    expect(events).toEqual([
      'transaction-committed',
      'file-removed',
      'metadata-deleted',
    ]);
  });

  it('deletes metadata when the physical file is already missing', async () => {
    const {
      service,
      storage,
      queryBuilder,
      transactionRepository,
      repository,
    } = createService();
    const attachment = createAttachment({ deletedAt: undefined });
    queryBuilder.getMany
      .mockResolvedValueOnce([attachment])
      .mockResolvedValueOnce([]);
    transactionRepository.findOne.mockResolvedValue(attachment);
    storage.remove.mockResolvedValue(false);

    const result = await service.cleanupExpiredAttachments(
      new Date('2026-09-16T03:00:00.000Z'),
    );

    expect(repository.delete).toHaveBeenCalledWith('attachment-id');
    expect(result.missingFileCount).toBe(1);
    expect(result.deletedMetadataCount).toBe(1);
  });

  it('keeps the original deletedAt for an existing cleanup candidate', async () => {
    const {
      service,
      storage,
      queryBuilder,
      transactionRepository,
      repository,
    } = createService();
    const deletedAt = new Date('2026-09-01T00:00:00.000Z');
    const attachment = createAttachment({ deletedAt });
    queryBuilder.getMany
      .mockResolvedValueOnce([attachment])
      .mockResolvedValueOnce([]);
    transactionRepository.findOne.mockResolvedValue(attachment);
    storage.remove.mockResolvedValue(true);

    const result = await service.cleanupExpiredAttachments(
      new Date('2026-09-16T03:00:00.000Z'),
    );

    expect(transactionRepository.update).not.toHaveBeenCalled();
    expect(attachment.deletedAt).toBe(deletedAt);
    expect(storage.remove).toHaveBeenCalledWith(attachment.storageKey);
    expect(repository.delete).toHaveBeenCalledWith(attachment.id);
    expect(result.deletedMetadataCount).toBe(1);
    expect(result.failedCount).toBe(0);
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
    expect(transactionRepository.update).not.toHaveBeenCalled();
    expect(result.failedCount).toBe(0);
    expect(result.deletedMetadataCount).toBe(0);
  });

  it('keeps an orphan claim when file removal fails and retries it later', async () => {
    const {
      service,
      storage,
      queryBuilder,
      transactionRepository,
      repository,
    } = createService();
    const attachment = createAttachment({ deletedAt: undefined });
    const cutoff = new Date('2026-09-09T03:00:00.000Z');

    queryBuilder.getMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([attachment])
      .mockResolvedValueOnce([attachment])
      .mockResolvedValueOnce([]);
    transactionRepository.findOne.mockResolvedValue(attachment);
    transactionRepository.update.mockImplementation(
      (_id: string, patch: Partial<Attachment>) => {
        Object.assign(attachment, patch);
        return Promise.resolve({ affected: 1 });
      },
    );
    storage.remove
      .mockRejectedValueOnce(new Error('disk unavailable'))
      .mockResolvedValueOnce(false);

    const failedResult = await service.cleanupExpiredAttachments(
      new Date('2026-09-16T03:00:00.000Z'),
    );

    expect(transactionRepository.update).toHaveBeenCalledWith(attachment.id, {
      deletedAt: cutoff,
    });
    expect(attachment.deletedAt).toEqual(cutoff);
    expect(repository.delete).not.toHaveBeenCalled();
    expect(failedResult.failedCount).toBe(1);
    expect(failedResult.deletedMetadataCount).toBe(0);

    const retriedResult = await service.cleanupExpiredAttachments(
      new Date('2026-09-17T03:00:00.000Z'),
    );

    expect(transactionRepository.update).toHaveBeenCalledTimes(1);
    expect(repository.delete).toHaveBeenCalledWith(attachment.id);
    expect(retriedResult.failedCount).toBe(0);
    expect(retriedResult.missingFileCount).toBe(1);
    expect(retriedResult.deletedMetadataCount).toBe(1);
  });

  it('keeps an orphan claim when metadata deletion fails', async () => {
    const {
      service,
      storage,
      queryBuilder,
      transactionRepository,
      repository,
    } = createService();
    const attachment = createAttachment({ deletedAt: undefined });
    const cutoff = new Date('2026-09-09T03:00:00.000Z');

    queryBuilder.getMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([attachment]);
    transactionRepository.findOne.mockResolvedValue(attachment);
    transactionRepository.update.mockImplementation(
      (_id: string, patch: Partial<Attachment>) => {
        Object.assign(attachment, patch);
        return Promise.resolve({ affected: 1 });
      },
    );
    repository.delete.mockRejectedValueOnce(new Error('database unavailable'));
    storage.remove.mockResolvedValue(true);

    const result = await service.cleanupExpiredAttachments(
      new Date('2026-09-16T03:00:00.000Z'),
    );

    expect(transactionRepository.update).toHaveBeenCalledWith(attachment.id, {
      deletedAt: cutoff,
    });
    expect(attachment.deletedAt).toEqual(cutoff);
    expect(result.failedCount).toBe(1);
    expect(result.deletedMetadataCount).toBe(0);
  });

  it('keeps metadata and continues when one attachment fails', async () => {
    const {
      service,
      storage,
      queryBuilder,
      transactionRepository,
      repository,
    } = createService();
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

    expect(repository.delete).toHaveBeenCalledTimes(1);
    expect(repository.delete).toHaveBeenCalledWith('success-id');
    expect(result.failedCount).toBe(1);
    expect(result.deletedMetadataCount).toBe(1);
  });

  it('advances past failed records so later candidates are still cleaned', async () => {
    const {
      service,
      storage,
      queryBuilder,
      transactionRepository,
      repository,
    } = createService({
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

    const result = await service.cleanupExpiredAttachments(
      new Date('2026-09-16T03:00:00.000Z'),
    );

    expect(queryBuilder.andWhere).toHaveBeenCalledWith('attachment.id > :id', {
      id: 'failed-id',
    });
    expect(repository.delete).toHaveBeenCalledWith('success-id');
    expect(result.failedCount).toBe(1);
    expect(result.deletedMetadataCount).toBe(1);
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
