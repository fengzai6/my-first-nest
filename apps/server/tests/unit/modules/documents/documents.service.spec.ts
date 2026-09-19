import { SpecialRolesEnum } from '@/common/decorators/special-roles.decorator';
import { DocumentExceptionCode } from '@/common/exceptions/document.exception';
import { ATTACHMENT_BIZ_TYPE } from '@/modules/attachments/constants/attachment.constants';
import { Document } from '@/modules/documents/entities/document.entity';
import { DocumentsService } from '@/modules/documents/documents.service';
import { DOCUMENT_STATUS } from '@/modules/documents/constants/document.constants';
import { RoleCode } from '@/common/constants/roles';
import { RolesService } from '@/modules/roles/roles.service';
import { User } from '@/modules/users/entities/user.entity';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { beforeEach, describe, expect, it, MockInstance, vi } from 'vitest';

type MockRepository = {
  create: MockInstance<(value: Partial<Document>) => Document>;
  findOne: MockInstance<(options: unknown) => Promise<Document | null>>;
  findOneBy: MockInstance<(options: unknown) => Promise<Document | null>>;
  merge: MockInstance<
    (target: Document, source: Partial<Document>) => Document
  >;
  save: MockInstance<
    (value: Document | Document[]) => Promise<Document | Document[]>
  >;
  softRemove: MockInstance<
    (value: Document | Document[]) => Promise<Document | Document[]>
  >;
  createQueryBuilder: MockInstance<() => unknown>;
};

const createUser = ({
  id = 'user-id',
  specialRoles = [],
}: Partial<User> = {}) => {
  const user = new User();
  user.id = id;
  user.username = id;
  user.nickname = id;
  user.specialRoles = specialRoles;
  return user;
};

const createDocument = ({
  id = 'document-id',
  title = '学习记录',
  content = '正文',
  status = DOCUMENT_STATUS.DRAFT,
  owner = createUser(),
}: Partial<Document> = {}) => {
  const document = new Document();
  document.id = id;
  document.title = title;
  document.content = content;
  document.status = status;
  document.owner = owner;
  document.createdAt = new Date('2026-09-16T00:00:00.000Z');
  document.updatedAt = new Date('2026-09-16T00:00:00.000Z');
  return document;
};

const createRole = (code: string) => ({ code });

const createService = () => {
  const documentsRepository: MockRepository = {
    create: vi.fn((value) =>
      Object.assign(new Document(), { id: 'document-id' }, value),
    ),
    findOne: vi.fn(),
    findOneBy: vi.fn(),
    merge: vi.fn((target, source) => Object.assign(target, source)),
    save: vi.fn((value) => Promise.resolve(value)),
    softRemove: vi.fn((value) => Promise.resolve(value)),
    createQueryBuilder: vi.fn(),
  };

  const managerRepository: MockRepository = {
    create: vi.fn((value) =>
      Object.assign(new Document(), { id: 'document-id' }, value),
    ),
    findOne: vi.fn(),
    findOneBy: vi.fn(),
    merge: vi.fn((target, source) => Object.assign(target, source)),
    save: vi.fn((value) => Promise.resolve(value)),
    softRemove: vi.fn((value) => Promise.resolve(value)),
    createQueryBuilder: vi.fn(),
  };

  const transaction = vi.fn(
    async (run: (manager: EntityManager) => Promise<unknown>) =>
      run({
        getRepository: vi.fn(() => managerRepository),
      } as unknown as EntityManager),
  );
  const dataSource = {
    transaction,
  } as unknown as DataSource;

  const findByUser = vi.fn();
  const rolesService = {
    findByUser,
  } as unknown as RolesService;

  const syncDocumentAttachments = vi.fn();
  const attachmentsService = {
    syncDocumentAttachments,
    softRemoveByBusiness: vi.fn(),
    findByBusiness: vi.fn().mockResolvedValue([]),
    countActiveByBusiness: vi.fn().mockResolvedValue(new Map()),
    findOne: vi.fn(),
    createSignedUrlForUser: vi.fn(),
  };

  return {
    dataSource,
    transaction,
    documentsRepository,
    managerRepository,
    rolesService,
    findByUser,
    attachmentsService,
    syncDocumentAttachments,
    service: new DocumentsService(
      documentsRepository as unknown as Repository<Document>,
      dataSource as unknown as DataSource,
      rolesService as unknown as RolesService,
      attachmentsService as never,
    ),
  };
};

describe('DocumentsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a document and binds attachments in one transaction', async () => {
    const {
      service,
      transaction,
      documentsRepository,
      managerRepository,
      syncDocumentAttachments,
    } = createService();
    const user = createUser();
    const document = createDocument({ owner: user });

    managerRepository.save.mockResolvedValue(document);
    documentsRepository.findOne.mockResolvedValue(document);

    await service.create(
      {
        title: '学习记录',
        content: '正文',
        attachmentIds: ['attachment-id'],
      },
      user,
    );

    expect(transaction).toHaveBeenCalledTimes(1);
    expect(syncDocumentAttachments).toHaveBeenCalledWith(
      'document-id',
      ['attachment-id'],
      expect.anything(),
      user,
    );
  });

  it('rejects another ordinary user before returning a document', async () => {
    const { service, documentsRepository, findByUser, attachmentsService } =
      createService();
    const owner = createUser({ id: 'owner-id' });
    const other = createUser({ id: 'other-id' });
    documentsRepository.findOne.mockResolvedValue(createDocument({ owner }));
    findByUser.mockResolvedValue([createRole(RoleCode.USER)]);

    await expect(service.findOne('document-id', other)).rejects.toMatchObject({
      code: DocumentExceptionCode.FORBIDDEN,
    });
    expect(attachmentsService.findByBusiness.mock.calls).toHaveLength(0);
  });

  it('soft removes the document and its attachments in one transaction', async () => {
    const {
      service,
      documentsRepository,
      managerRepository,
      attachmentsService,
    } = createService();
    const owner = createUser();
    documentsRepository.findOne.mockResolvedValue(createDocument({ owner }));

    await service.remove('document-id', owner);

    expect(managerRepository.softRemove).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'document-id' }),
    );
    expect(attachmentsService.softRemoveByBusiness).toHaveBeenCalledWith(
      ATTACHMENT_BIZ_TYPE.DOCUMENT,
      'document-id',
      expect.anything(),
    );
  });

  it('allows an admin to read another user document', async () => {
    const { service, documentsRepository, findByUser, attachmentsService } =
      createService();
    const owner = createUser({ id: 'owner-id' });
    const admin = createUser({ id: 'admin-id' });
    const document = createDocument({ owner });

    documentsRepository.findOne.mockResolvedValue(document);
    findByUser.mockResolvedValue([createRole(RoleCode.ADMIN)]);

    await expect(service.findOne('document-id', admin)).resolves.toMatchObject({
      id: 'document-id',
    });
    expect(attachmentsService.findByBusiness.mock.calls).toContainEqual([
      ATTACHMENT_BIZ_TYPE.DOCUMENT,
      'document-id',
    ]);
  });

  it('allows a super admin to read another user document', async () => {
    const { service, documentsRepository, findByUser } = createService();
    const owner = createUser({ id: 'owner-id' });
    const superAdmin = createUser({
      id: 'super-admin-id',
      specialRoles: [SpecialRolesEnum.SuperAdmin],
    });

    documentsRepository.findOne.mockResolvedValue(createDocument({ owner }));

    await expect(
      service.findOne('document-id', superAdmin),
    ).resolves.toMatchObject({
      id: 'document-id',
    });
    expect(findByUser).not.toHaveBeenCalled();
  });

  it('soft removes all attachments when update receives an empty array', async () => {
    const { service, documentsRepository, attachmentsService } =
      createService();
    const owner = createUser();
    documentsRepository.findOne.mockResolvedValue(createDocument({ owner }));

    await service.update('document-id', { attachmentIds: [] }, owner);

    expect(attachmentsService.syncDocumentAttachments).toHaveBeenCalledWith(
      'document-id',
      [],
      expect.anything(),
      owner,
    );
  });

  it('returns a deleted owner placeholder in the document list', async () => {
    const { service, documentsRepository, attachmentsService } =
      createService();
    const superAdmin = createUser({
      id: 'super-admin-id',
      specialRoles: [SpecialRolesEnum.SuperAdmin],
    });
    const queryBuilder = {
      leftJoinAndSelect: vi.fn().mockReturnThis(),
      withDeleted: vi.fn().mockReturnThis(),
      andWhere: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      skip: vi.fn().mockReturnThis(),
      take: vi.fn().mockReturnThis(),
      getManyAndCount: vi.fn().mockResolvedValue([
        [
          createDocument({
            id: 'deleted-owner-document-id',
            owner: null as unknown as User,
          }),
        ],
        1,
      ]),
    };
    documentsRepository.createQueryBuilder.mockReturnValue(queryBuilder);
    attachmentsService.countActiveByBusiness.mockResolvedValue(new Map());

    await expect(
      service.findAll({ page: 1, pageSize: 20 }, superAdmin),
    ).resolves.toMatchObject({
      list: [
        {
          owner: {
            id: '',
            displayName: '已删除用户',
          },
        },
      ],
    });
    expect(queryBuilder.withDeleted).toHaveBeenCalled();
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'document.deletedAt IS NULL',
    );
  });

  it('does not sync attachments when update omits attachmentIds', async () => {
    const { service, documentsRepository, attachmentsService } =
      createService();
    const owner = createUser();
    documentsRepository.findOne.mockResolvedValue(createDocument({ owner }));

    await service.update('document-id', { title: '更新标题' }, owner);

    expect(attachmentsService.syncDocumentAttachments).not.toHaveBeenCalled();
  });

  it('rejects signing an attachment that belongs to another document', async () => {
    const { service, documentsRepository, attachmentsService } =
      createService();
    const owner = createUser();
    documentsRepository.findOne.mockResolvedValue(createDocument({ owner }));
    attachmentsService.findOne.mockResolvedValue({
      id: 'attachment-id',
      bizType: ATTACHMENT_BIZ_TYPE.DOCUMENT,
      bizId: 'other-document-id',
    });

    await expect(
      service.createAttachmentSignedUrl('document-id', 'attachment-id', owner),
    ).rejects.toMatchObject({
      code: 'ATTACHMENT_NOT_FOUND',
    });
  });

  it('uses the document reader identity when signing an attachment', async () => {
    const { service, documentsRepository, attachmentsService } =
      createService();
    const owner = createUser();
    documentsRepository.findOne.mockResolvedValue(createDocument({ owner }));
    attachmentsService.findOne.mockResolvedValue({
      id: 'attachment-id',
      bizType: ATTACHMENT_BIZ_TYPE.DOCUMENT,
      bizId: 'document-id',
    });
    attachmentsService.createSignedUrlForUser.mockResolvedValue({
      url: '/api/attachments/content/attachment-id',
      expiresAt: 123,
    });

    await expect(
      service.createAttachmentSignedUrl('document-id', 'attachment-id', owner),
    ).resolves.toMatchObject({
      url: '/api/attachments/content/attachment-id',
    });
    expect(attachmentsService.createSignedUrlForUser).toHaveBeenCalledWith(
      'attachment-id',
      owner.id,
    );
  });
});
