import { userContextStorage } from '@/common/context/user-context';
import { SpecialRolesEnum } from '@/common/decorators/special-roles.decorator';
import { AttachmentExceptionCode } from '@/common/exceptions/attachment.exception';
import { Attachment } from '@/modules/attachments/entities/attachment.entity';
import { AttachmentSignatureService } from '@/modules/attachments/attachment-signature.service';
import {
  ATTACHMENT_BIZ_TYPE,
  ATTACHMENT_VISIBILITY,
} from '@/modules/attachments/constants/attachment.constants';
import { AttachmentsService } from '@/modules/attachments/attachments.service';
import { User } from '@/modules/users/entities/user.entity';
import { Readable } from 'stream';
import { EntityManager, FindOperator } from 'typeorm';
import { beforeEach, describe, expect, it, MockInstance, vi } from 'vitest';

type FindAttachmentsOptions = {
  where: {
    bizType: string;
    bizId: string;
    id: FindOperator<string>;
    deletedAt: FindOperator<null>;
  };
};

type MockRepository = {
  create: MockInstance<(value: Partial<Attachment>) => Attachment>;
  find: MockInstance<
    (options: FindAttachmentsOptions) => Promise<Attachment[]>
  >;
  findOne: MockInstance<(options: unknown) => Promise<Attachment | null>>;
  merge: MockInstance<
    (target: Attachment, source: Partial<Attachment>) => Attachment
  >;
  save: MockInstance<
    (value: Attachment | Attachment[]) => Promise<Attachment | Attachment[]>
  >;
  softRemove: MockInstance<
    (value: Attachment | Attachment[]) => Promise<Attachment | Attachment[]>
  >;
};

const createManager = () => {
  const repository: MockRepository = {
    create: vi.fn((value) =>
      Object.assign(new Attachment(), { id: 'attachment-id' }, value),
    ),
    find: vi.fn(),
    findOne: vi.fn(),
    merge: vi.fn((target, source) => Object.assign(target, source)),
    save: vi.fn((value) => Promise.resolve(value)),
    softRemove: vi.fn((value) => Promise.resolve(value)),
  };

  return {
    repository,
    manager: {
      getRepository: vi.fn(() => repository),
    } as unknown as EntityManager,
  };
};

const createUser = ({
  id = 'user-id',
  specialRoles = [],
}: Partial<User> = {}) => {
  const user = new User();
  user.id = id;
  user.specialRoles = specialRoles;
  return user;
};

const createAttachment = ({
  id = 'attachment-id',
  visibility = ATTACHMENT_VISIBILITY.PRIVATE,
  uploadedBy = createUser(),
  bizType = null,
  bizId = null,
}: Partial<Attachment> = {}) => {
  const attachment = new Attachment();
  attachment.id = id;
  attachment.originalName = 'image.png';
  attachment.storageKey = '2026/09/image.png';
  attachment.mimeType = 'image/png';
  attachment.size = 100;
  attachment.visibility = visibility;
  attachment.uploadedBy = uploadedBy;
  attachment.bizType = bizType;
  attachment.bizId = bizId;
  attachment.createdAt = new Date('2026-09-13T00:00:00.000Z');
  return attachment;
};

const createService = () => {
  const repository: MockRepository = {
    create: vi.fn((value) =>
      Object.assign(new Attachment(), { id: 'attachment-id' }, value),
    ),
    find: vi.fn(),
    findOne: vi.fn(),
    merge: vi.fn((target, source) => Object.assign(target, source)),
    save: vi.fn((value) => Promise.resolve(value)),
    softRemove: vi.fn((value) => Promise.resolve(value)),
  };
  const storage = {
    save: vi.fn(),
    read: vi.fn(),
    remove: vi.fn(),
    cleanup: vi.fn(),
  };
  const createSignedUrl = vi.fn((id: string, userId: string) => ({
    url: `/api/attachments/content/${id}?userId=${userId}&signature=signed`,
    expiresAt: Date.now() + 300_000,
  }));
  const verifySignature = vi.fn();
  const signatureService = {
    createSignedUrl,
    verifySignature,
    getExpiresIn: vi.fn(() => 300),
    getUrlPrefix: vi.fn(() => '/api/attachments/content'),
  } as unknown as AttachmentSignatureService;

  return {
    repository,
    storage,
    createSignedUrl,
    verifySignature,
    signatureService,
    service: new AttachmentsService(
      repository as never,
      storage,
      signatureService,
    ),
  };
};

describe('AttachmentsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns a public url for an uploaded public file', async () => {
    const { repository, storage, service } = createService();
    const user = createUser();
    const file = {
      originalname: 'image.png',
      mimetype: 'image/png',
      size: 100,
      buffer: Buffer.from('image'),
    } as Express.Multer.File;

    storage.save.mockResolvedValue({ key: '2026/09/image.png' });

    const result = await service.upload(
      [file],
      { visibility: ATTACHMENT_VISIBILITY.PUBLIC },
      user,
    );

    expect(result[0]).toMatchObject({
      id: 'attachment-id',
      visibility: ATTACHMENT_VISIBILITY.PUBLIC,
      url: '/api/attachments/content/attachment-id',
    });
    expect(repository.save).toHaveBeenCalled();
  });

  it('removes saved files when metadata persistence fails', async () => {
    const { repository, storage, service } = createService();
    const user = createUser();
    const file = {
      originalname: 'image.png',
      mimetype: 'image/png',
      size: 100,
      buffer: Buffer.from('image'),
    } as Express.Multer.File;

    storage.save.mockResolvedValue({ key: '2026/09/image.png' });
    repository.save.mockRejectedValue(new Error('database unavailable'));

    await expect(
      service.upload(
        [file],
        { visibility: ATTACHMENT_VISIBILITY.PUBLIC },
        user,
      ),
    ).rejects.toThrow('database unavailable');
    expect(storage.remove).toHaveBeenCalledWith('2026/09/image.png');
  });

  it('allows the uploader to obtain a private signed url', async () => {
    const { repository, createSignedUrl, service } = createService();
    const user = createUser();

    repository.findOne.mockResolvedValue(
      createAttachment({ uploadedBy: user }),
    );

    const result = await userContextStorage.run(user, () =>
      service.createSignedUrl('attachment-id'),
    );

    expect(result.url).toBe(
      '/api/attachments/content/attachment-id?userId=user-id&signature=signed',
    );
    expect(result.expiresAt).toBeGreaterThan(Date.now());
    expect(createSignedUrl).toHaveBeenCalledWith('attachment-id', 'user-id');
  });

  it('returns public content without a signature', async () => {
    const { repository, storage, service } = createService();

    repository.findOne.mockResolvedValue(
      createAttachment({
        visibility: ATTACHMENT_VISIBILITY.PUBLIC,
        uploadedBy: createUser(),
      }),
    );
    storage.read.mockResolvedValue({ stream: Readable.from('image') });

    await expect(service.getContent('attachment-id')).resolves.toMatchObject({
      attachment: { id: 'attachment-id' },
    });
  });

  it('rejects private content with an invalid signature', async () => {
    const { repository, verifySignature, service } = createService();

    repository.findOne.mockResolvedValue(createAttachment());
    verifySignature.mockReturnValue(false);

    await expect(
      service.getContent('attachment-id', '123', 'user-id', 'invalid'),
    ).rejects.toMatchObject({
      code: AttachmentExceptionCode.INVALID_SIGNATURE,
    });
  });

  it('rejects signed url requests from another ordinary user', async () => {
    const { repository, service } = createService();
    const uploader = createUser();
    const otherUser = createUser({ id: 'other-user' });

    repository.findOne.mockResolvedValue(
      createAttachment({ uploadedBy: uploader }),
    );

    await userContextStorage.run(otherUser, async () => {
      await expect(
        service.createSignedUrl('attachment-id'),
      ).rejects.toMatchObject({
        code: AttachmentExceptionCode.FORBIDDEN,
      });
    });
  });

  it('allows a super admin to obtain a private signed url', async () => {
    const { repository, storage, verifySignature, service } = createService();
    const uploader = createUser();
    const admin = createUser({
      id: 'admin-id',
      specialRoles: [SpecialRolesEnum.SuperAdmin],
    });

    repository.findOne.mockResolvedValue(
      createAttachment({ uploadedBy: uploader }),
    );

    const result = await userContextStorage.run(admin, () =>
      service.createSignedUrl('attachment-id'),
    );

    expect(result.url).toContain('/api/attachments/content/attachment-id');

    verifySignature.mockReturnValue(true);
    storage.read.mockResolvedValue({ stream: Readable.from('image') });

    await expect(
      service.getContent(
        'attachment-id',
        String(result.expiresAt),
        admin.id,
        'signed',
      ),
    ).resolves.toMatchObject({ attachment: { id: 'attachment-id' } });
  });

  it('soft deletes attachment metadata without removing the stored file', async () => {
    const { repository, storage, service } = createService();
    const user = createUser();

    repository.findOne.mockResolvedValue(
      createAttachment({ uploadedBy: user }),
    );

    await userContextStorage.run(user, async () => {
      await service.remove('attachment-id');
    });

    expect(repository.softRemove).toHaveBeenCalledTimes(1);
    expect(storage.remove).not.toHaveBeenCalled();
  });

  it('rejects updates from another ordinary user', async () => {
    const { repository, service } = createService();
    const uploader = createUser();
    const otherUser = createUser({ id: 'other-user' });

    repository.findOne.mockResolvedValue(
      createAttachment({ uploadedBy: uploader }),
    );

    await userContextStorage.run(otherUser, async () => {
      await expect(
        service.update('attachment-id', {
          visibility: ATTACHMENT_VISIBILITY.PUBLIC,
        }),
      ).rejects.toMatchObject({
        code: AttachmentExceptionCode.FORBIDDEN,
      });
    });
  });

  it('rejects updating a bound avatar through the generic update flow', async () => {
    const { repository, service } = createService();
    const user = createUser();

    repository.findOne.mockResolvedValue(
      createAttachment({
        uploadedBy: user,
        bizType: ATTACHMENT_BIZ_TYPE.USER_AVATAR,
        bizId: user.id,
      }),
    );

    await userContextStorage.run(user, async () => {
      await expect(
        service.update('attachment-id', {
          visibility: ATTACHMENT_VISIBILITY.PRIVATE,
        }),
      ).rejects.toMatchObject({
        code: AttachmentExceptionCode.IN_USE,
      });
    });
  });

  it('rejects deleting a bound avatar through the generic delete flow', async () => {
    const { repository, service } = createService();
    const user = createUser();

    repository.findOne.mockResolvedValue(
      createAttachment({
        uploadedBy: user,
        bizType: ATTACHMENT_BIZ_TYPE.USER_AVATAR,
        bizId: user.id,
      }),
    );

    await userContextStorage.run(user, async () => {
      await expect(service.remove('attachment-id')).rejects.toMatchObject({
        code: AttachmentExceptionCode.IN_USE,
      });
    });
  });

  it('rejects an ordinary user binding another user upload', async () => {
    const { service } = createService();
    const uploader = createUser({ id: 'uploader-id' });
    const user = createUser({ id: 'user-id' });
    const attachment = createAttachment({
      uploadedBy: uploader,
      visibility: ATTACHMENT_VISIBILITY.PUBLIC,
    });
    const { manager, repository } = createManager();

    repository.findOne.mockResolvedValue(attachment);

    await userContextStorage.run(user, async () => {
      await expect(
        service.bindUserAvatar(user.id, attachment.id, manager),
      ).rejects.toMatchObject({
        code: AttachmentExceptionCode.FORBIDDEN,
      });
    });
  });

  it('allows a super admin to bind another user upload', async () => {
    const { service } = createService();
    const uploader = createUser();
    const admin = createUser({
      id: 'admin-id',
      specialRoles: [SpecialRolesEnum.SuperAdmin],
    });
    const attachment = createAttachment({ uploadedBy: uploader });
    const { manager, repository: transactionalRepository } = createManager();

    transactionalRepository.findOne.mockResolvedValue(attachment);
    transactionalRepository.find.mockResolvedValue([]);

    await userContextStorage.run(admin, async () => {
      await expect(
        service.bindUserAvatar('target-user-id', attachment.id, manager),
      ).resolves.toBe('/api/attachments/content/attachment-id');
    });
  });

  it('binds an avatar as public and soft deletes the previous avatar', async () => {
    const { service } = createService();
    const user = createUser();
    const attachment = createAttachment({ uploadedBy: user });
    const oldAttachment = createAttachment({ id: 'old-avatar-id' });
    const { manager, repository: transactionalRepository } = createManager();

    transactionalRepository.findOne.mockResolvedValue(attachment);
    transactionalRepository.find.mockResolvedValue([oldAttachment]);

    await userContextStorage.run(user, async () => {
      await expect(
        service.bindUserAvatar('user-id', 'attachment-id', manager),
      ).resolves.toBe('/api/attachments/content/attachment-id');
    });

    expect(attachment.visibility).toBe(ATTACHMENT_VISIBILITY.PUBLIC);
    expect(attachment.bizType).toBe(ATTACHMENT_BIZ_TYPE.USER_AVATAR);
    expect(transactionalRepository.findOne).toHaveBeenCalledWith({
      where: { id: 'attachment-id' },
      relations: { uploadedBy: true },
    });
    expect(transactionalRepository.find).toHaveBeenCalledTimes(1);
    const findOptions = transactionalRepository.find.mock.calls[0]?.[0];
    expect(findOptions?.where).toMatchObject({
      bizType: ATTACHMENT_BIZ_TYPE.USER_AVATAR,
      bizId: 'user-id',
    });
    expect(findOptions?.where.id).toBeInstanceOf(FindOperator);
    expect(findOptions?.where.deletedAt).toBeInstanceOf(FindOperator);
    expect(transactionalRepository.softRemove).toHaveBeenCalledWith([
      oldAttachment,
    ]);
    expect(transactionalRepository.save).toHaveBeenCalledWith(attachment);
  });
});
