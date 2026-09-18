import { AttachmentExceptionCode } from '@/common/exceptions/attachment.exception';
import { ATTACHMENT_VISIBILITY } from '@/modules/attachments/constants/attachment.constants';
import { Attachment } from '@/modules/attachments/entities/attachment.entity';
import { AttachmentManagementService } from '@/modules/attachments/services/attachment-management.service';
import { User } from '@/modules/users/entities/user.entity';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const createQueryBuilder = () => {
  const builder = {
    leftJoinAndSelect: vi.fn(),
    withDeleted: vi.fn(),
    andWhere: vi.fn(),
    orderBy: vi.fn(),
    addOrderBy: vi.fn(),
    skip: vi.fn(),
    take: vi.fn(),
    getManyAndCount: vi.fn().mockResolvedValue([[], 0]),
  };
  builder.leftJoinAndSelect.mockReturnValue(builder);
  builder.withDeleted.mockReturnValue(builder);
  builder.andWhere.mockReturnValue(builder);
  builder.orderBy.mockReturnValue(builder);
  builder.addOrderBy.mockReturnValue(builder);
  builder.skip.mockReturnValue(builder);
  builder.take.mockReturnValue(builder);
  return builder;
};

const createAttachment = (overrides: Partial<Attachment> = {}) => {
  const user = new User();
  user.id = 'user-id';
  user.nickname = '上传用户';

  const attachment = new Attachment();
  attachment.id = 'attachment-id';
  attachment.originalName = 'report.pdf';
  attachment.mimeType = 'application/pdf';
  attachment.size = 100;
  attachment.visibility = ATTACHMENT_VISIBILITY.PRIVATE;
  attachment.storageProvider = 'local';
  attachment.storageKey = '2026/09/report.pdf';
  attachment.bizType = null;
  attachment.bizId = null;
  attachment.uploadedBy = user;
  attachment.createdAt = new Date('2026-09-18T00:00:00.000Z');
  attachment.updatedAt = new Date('2026-09-18T00:00:00.000Z');
  Object.assign(attachment, overrides);
  return attachment;
};

const createManagementService = () => {
  const queryBuilder = createQueryBuilder();
  const repository = {
    createQueryBuilder: vi.fn().mockReturnValue(queryBuilder),
    findOne: vi.fn(),
    save: vi.fn(),
    softRemove: vi.fn(),
  };
  const signatureService = {
    createSignedUrl: vi.fn(),
  };
  const jobService = {
    hasActiveOrPending: vi.fn(),
    submit: vi.fn(),
    list: vi.fn(),
  };
  const configService = {
    get: vi.fn((key: string) => {
      if (key === 'default') {
        return { upload: { cleanupRetentionDays: 30 } };
      }
      return {};
    }),
  };
  const logger = {
    log: vi.fn(),
  };

  const service = new AttachmentManagementService(
    repository as never,
    signatureService as never,
    jobService as never,
    configService as never,
    logger as never,
  );

  return {
    queryBuilder,
    repository,
    signatureService,
    jobService,
    logger,
    service,
  };
};

describe('AttachmentManagementService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('filters deleted attachments only when includeDeleted is true', async () => {
    const { queryBuilder, service } = createManagementService();

    await service.findAll({});

    expect(queryBuilder.withDeleted).not.toHaveBeenCalled();
  });

  it('treats orphanOnly as excluding deleted attachments', async () => {
    const { queryBuilder, service } = createManagementService();

    await service.findAll({ orphanOnly: true, includeDeleted: true });

    expect(queryBuilder.withDeleted).not.toHaveBeenCalled();
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'attachment.bizType IS NULL',
    );
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'attachment.bizId IS NULL',
    );
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'attachment.deletedAt IS NULL',
    );
  });

  it('derives eligible cleanup status from retention cutoff', async () => {
    const { queryBuilder, service } = createManagementService();
    const attachment = createAttachment({
      deletedAt: new Date('2026-07-01T00:00:00.000Z'),
    });
    queryBuilder.getManyAndCount.mockResolvedValue([[attachment], 1]);

    const result = await service.findAll(
      {},
      new Date('2026-09-18T00:00:00.000Z'),
    );

    expect(result.list[0].cleanupStatus).toBe('eligible');
  });

  it('rejects visibility updates for bound attachments', async () => {
    const { repository, service } = createManagementService();
    repository.findOne.mockResolvedValue(
      createAttachment({ bizType: 'document', bizId: 'document-id' }),
    );

    await expect(
      service.updateVisibility('attachment-id', ATTACHMENT_VISIBILITY.PUBLIC),
    ).rejects.toMatchObject({ code: AttachmentExceptionCode.IN_USE });
  });

  it('updates visibility for orphan attachments', async () => {
    const { repository, service } = createManagementService();
    const attachment = createAttachment();
    repository.findOne.mockResolvedValue(attachment);
    repository.save.mockImplementation((value: Attachment) =>
      Promise.resolve(value),
    );

    const result = await service.updateVisibility(
      'attachment-id',
      ATTACHMENT_VISIBILITY.PUBLIC,
    );

    expect(result.visibility).toBe(ATTACHMENT_VISIBILITY.PUBLIC);
  });

  it('returns per-item failures for bulk operations', async () => {
    const { repository, service } = createManagementService();
    repository.findOne
      .mockResolvedValueOnce(createAttachment({ id: 'a' }))
      .mockResolvedValueOnce(
        createAttachment({
          id: 'b',
          bizType: 'document',
          bizId: 'document-id',
        }),
      );
    repository.softRemove.mockImplementation((value: Attachment) =>
      Promise.resolve(value),
    );

    const result = await service.bulkSoftDelete(['a', 'b']);

    expect(result.succeeded).toEqual(['a']);
    expect(result.failed).toEqual([
      { id: 'b', reason: '已绑定的附件不能通过通用接口修改或删除' },
    ]);
  });

  it('rejects cleanup when an active cleanup task exists', async () => {
    const { jobService, service } = createManagementService();
    jobService.hasActiveOrPending.mockResolvedValue(true);

    await expect(
      service.triggerCleanup({ id: 'admin-id' } as User),
    ).rejects.toMatchObject({
      code: AttachmentExceptionCode.CLEANUP_ALREADY_RUNNING,
    });
  });

  it('submits a manual cleanup job', async () => {
    const { jobService, service } = createManagementService();
    jobService.hasActiveOrPending.mockResolvedValue(false);
    jobService.submit.mockResolvedValue({ id: 'job-id' });

    await expect(
      service.triggerCleanup({ id: 'admin-id' } as User),
    ).resolves.toEqual({ id: 'job-id' });

    expect(jobService.submit).toHaveBeenCalledWith({
      name: 'cleanup-attachments',
      payload: {},
      attempts: 3,
      backoffMs: 2000,
      triggerType: 'manual',
      createdBy: 'admin-id',
    });
  });
});
