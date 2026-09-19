import { useRequestUser } from '@/common/context/user-context';
import { PermissionCode } from '@/common/constants/permissions';
import { SpecialRolesEnum } from '@/common/decorators/special-roles.decorator';
import {
  AttachmentException,
  AttachmentExceptionCode,
} from '@/common/exceptions/attachment.exception';
import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  EntityManager,
  FindOptionsWhere,
  In,
  IsNull,
  Not,
  Repository,
} from 'typeorm';
import { AttachmentSignatureService } from './attachment-signature.service';
import {
  ATTACHMENT_SIGNATURE_SCOPE,
  AttachmentSignatureScope,
} from './attachment-signature.service';
import {
  ATTACHMENT_BIZ_TYPE,
  ATTACHMENT_MIME_TYPES,
  ATTACHMENT_STORAGE_PROVIDER,
  ATTACHMENT_VISIBILITY,
  AttachmentVisibility,
  MAX_ATTACHMENT_SIZE,
  MAX_AVATAR_SIZE,
  AVATAR_MIME_TYPES,
} from './constants/attachment.constants';
import { UpdateAttachmentDto } from './dto/update-attachment.dto';
import { UploadAttachmentDto } from './dto/upload-attachment.dto';
import { Attachment } from './entities/attachment.entity';
import {
  ATTACHMENT_STORAGE,
  IAttachmentStorage,
  IReadableStoredFile,
} from './interfaces/attachment-storage.interface';
import { User } from '@/modules/users/entities/user.entity';
import { PermissionsService } from '@/modules/permissions/permissions.service';
import {
  AttachmentCleanupService,
  ICleanupAttachmentsResult,
} from './services/attachment-cleanup.service';
import { normalizeMultipartFilename } from './utils/normalize-multipart-filename';

export interface IAttachmentView {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
  visibility: AttachmentVisibility;
  storageProvider: string;
  bizType: string | null;
  bizId: string | null;
  url: string;
  createdAt: Date;
}

@Injectable()
export class AttachmentsService {
  constructor(
    @InjectRepository(Attachment)
    private readonly attachmentRepository: Repository<Attachment>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @Inject(ATTACHMENT_STORAGE)
    private readonly storage: IAttachmentStorage,
    private readonly signatureService: AttachmentSignatureService,
    private readonly cleanupService: AttachmentCleanupService,
    private readonly permissionsService: PermissionsService,
  ) {}

  cleanupExpiredAttachments(now?: Date): Promise<ICleanupAttachmentsResult> {
    return this.cleanupService.cleanupExpiredAttachments(now);
  }

  async upload(
    files: Express.Multer.File[],
    dto: UploadAttachmentDto,
    user: User,
  ): Promise<IAttachmentView[]> {
    if (!files || files.length === 0) {
      throw new AttachmentException(AttachmentExceptionCode.FILE_REQUIRED);
    }

    const visibility = dto.visibility ?? ATTACHMENT_VISIBILITY.PRIVATE;

    for (const file of files) {
      this.validateFile(file, MAX_ATTACHMENT_SIZE, ATTACHMENT_MIME_TYPES);
    }

    const attachments: Attachment[] = [];
    const savedKeys: string[] = [];

    try {
      for (const file of files) {
        const { key } = await this.storage.save(file);
        savedKeys.push(key);
        const attachment = this.attachmentRepository.create({
          originalName: normalizeMultipartFilename(file.originalname),
          storageKey: key,
          mimeType: file.mimetype,
          size: file.size,
          visibility,
          storageProvider: ATTACHMENT_STORAGE_PROVIDER.LOCAL,
          bizType: null,
          bizId: null,
          uploadedBy: user,
        });
        attachments.push(attachment);
      }

      const saved = await this.attachmentRepository.save(attachments);

      return saved.map((attachment) => this.toView(attachment));
    } catch (error) {
      await Promise.allSettled(
        savedKeys.map((key) => this.storage.remove(key)),
      );
      throw error;
    }
  }

  async findByBusiness(
    bizType: string,
    bizId: string,
  ): Promise<IAttachmentView[]> {
    const where: FindOptionsWhere<Attachment> = {
      bizType,
      bizId,
      deletedAt: IsNull(),
    };
    const attachments = await this.attachmentRepository.find({
      where,
      order: { createdAt: 'ASC' },
    });

    return attachments.map((attachment) => this.toView(attachment));
  }

  async countActiveByBusiness(
    bizType: string,
    bizIds: string[],
  ): Promise<Map<string, number>> {
    if (bizIds.length === 0) return new Map();

    const rows = await this.attachmentRepository
      .createQueryBuilder('attachment')
      .select('attachment.bizId', 'bizId')
      .addSelect('COUNT(*)', 'count')
      .where('attachment.bizType = :bizType', { bizType })
      .andWhere('attachment.bizId IN (:...bizIds)', { bizIds })
      .andWhere('attachment.deletedAt IS NULL')
      .groupBy('attachment.bizId')
      .getRawMany<{ bizId: string; count: string }>();

    return new Map(rows.map((row) => [row.bizId, Number(row.count)]));
  }

  async syncDocumentAttachments(
    documentId: string,
    attachmentIds: string[],
    manager: EntityManager,
    user: User,
  ): Promise<void> {
    const repository = manager.getRepository(Attachment);
    const uniqueIds = [...new Set(attachmentIds)];
    const existing = await repository.find({
      where: {
        bizType: ATTACHMENT_BIZ_TYPE.DOCUMENT,
        bizId: documentId,
        deletedAt: IsNull(),
      },
    });

    const requested =
      uniqueIds.length === 0
        ? []
        : await repository.find({
            where: { id: In(uniqueIds) },
            relations: { uploadedBy: true },
          });

    if (requested.length !== uniqueIds.length) {
      throw new AttachmentException(AttachmentExceptionCode.NOT_FOUND);
    }

    const requestedIdSet = new Set(uniqueIds);
    const removed = existing.filter(
      (attachment) => !requestedIdSet.has(attachment.id),
    );
    const added = requested.filter(
      (attachment) =>
        attachment.bizType !== ATTACHMENT_BIZ_TYPE.DOCUMENT ||
        attachment.bizId !== documentId,
    );

    for (const attachment of added) {
      const isCurrentDocument =
        attachment.bizType === ATTACHMENT_BIZ_TYPE.DOCUMENT &&
        attachment.bizId === documentId;
      if (attachment.bizType && !isCurrentDocument) {
        throw new AttachmentException(AttachmentExceptionCode.IN_USE);
      }

      if (attachment.uploadedBy?.id !== user.id && !this.isSuperAdmin(user)) {
        throw new AttachmentException(AttachmentExceptionCode.FORBIDDEN);
      }

      this.validateFile(
        {
          mimetype: attachment.mimeType,
          size: attachment.size,
        } as Express.Multer.File,
        MAX_ATTACHMENT_SIZE,
        ATTACHMENT_MIME_TYPES,
      );
    }

    if (added.length > 0) {
      // NOTE: 条件更新保证并发事务不能同时把同一附件绑定到不同文档
      const result = await repository.update(
        {
          id: In(added.map((attachment) => attachment.id)),
          bizType: IsNull(),
          bizId: IsNull(),
        },
        {
          bizType: ATTACHMENT_BIZ_TYPE.DOCUMENT,
          bizId: documentId,
        },
      );

      if (result.affected === undefined || result.affected !== added.length) {
        throw new AttachmentException(AttachmentExceptionCode.IN_USE);
      }
    }
    if (removed.length > 0) {
      await repository.softRemove(removed);
    }
  }

  async softRemoveByBusiness(
    bizType: string,
    bizId: string,
    manager: EntityManager,
  ): Promise<void> {
    const repository = manager.getRepository(Attachment);
    const attachments = await repository.find({
      where: { bizType, bizId, deletedAt: IsNull() },
    });

    if (attachments.length > 0) {
      await repository.softRemove(attachments);
    }
  }

  async findOne(
    id: string,
    manager?: EntityManager,
    withDeleted = false,
  ): Promise<Attachment> {
    const repository =
      manager?.getRepository(Attachment) ?? this.attachmentRepository;
    const attachment = await repository.findOne({
      where: { id },
      relations: { uploadedBy: true },
      ...(withDeleted ? { withDeleted: true } : {}),
    });

    if (!attachment) {
      throw new AttachmentException(AttachmentExceptionCode.NOT_FOUND);
    }

    return attachment;
  }

  async createSignedUrl(
    id: string,
  ): Promise<{ url: string; expiresAt: number }> {
    const attachment = await this.findOne(id);
    const user = useRequestUser();
    this.assertCanAccessPrivate(attachment, user);

    return this.signatureService.createSignedUrl(attachment.id, user.id);
  }

  async createSignedUrlForUser(
    attachmentId: string,
    userId: string,
  ): Promise<{ url: string; expiresAt: number }> {
    await this.findOne(attachmentId);
    return this.signatureService.createSignedUrl(attachmentId, userId);
  }

  async getContent(
    id: string,
    expiresAt?: string,
    userId?: string,
    signature?: string,
    scope: AttachmentSignatureScope = ATTACHMENT_SIGNATURE_SCOPE.USER,
  ): Promise<{ attachment: Attachment; content: IReadableStoredFile }> {
    const attachment = await this.findOne(
      id,
      undefined,
      scope === ATTACHMENT_SIGNATURE_SCOPE.ADMIN,
    );

    if (
      scope !== ATTACHMENT_SIGNATURE_SCOPE.ADMIN &&
      attachment.visibility === ATTACHMENT_VISIBILITY.PUBLIC
    ) {
      return {
        attachment,
        content: await this.readStoredFile(attachment),
      };
    }

    if (!expiresAt || !userId || !signature) {
      throw new AttachmentException(AttachmentExceptionCode.INVALID_SIGNATURE);
    }

    const valid = this.signatureService.verifySignature(
      attachment.id,
      userId,
      Number(expiresAt),
      signature,
      scope,
    );

    if (!valid) {
      throw new AttachmentException(AttachmentExceptionCode.INVALID_SIGNATURE);
    }

    if (scope === ATTACHMENT_SIGNATURE_SCOPE.ADMIN) {
      const currentUser = await this.userRepository.findOneBy({
        id: userId,
        isActive: true,
      });
      const canRead =
        currentUser &&
        (this.isSuperAdmin(currentUser) ||
          (await this.permissionsService.hasUserPermission(
            userId,
            PermissionCode.ATTACHMENT_READ,
          )));

      if (!canRead) {
        throw new AttachmentException(
          attachment.deletedAt
            ? AttachmentExceptionCode.NOT_FOUND
            : AttachmentExceptionCode.FORBIDDEN,
        );
      }
    }

    return {
      attachment,
      content: await this.readStoredFile(attachment),
    };
  }

  async update(id: string, dto: UpdateAttachmentDto): Promise<IAttachmentView> {
    const attachment = await this.findOne(id);
    const user = useRequestUser();
    this.assertCanManage(attachment, user);
    this.assertNotBoundAvatar(attachment);

    if (
      attachment.bizType &&
      (Object.hasOwn(dto, 'bizType') || Object.hasOwn(dto, 'bizId'))
    ) {
      throw new AttachmentException(AttachmentExceptionCode.IN_USE);
    }

    const updated = this.attachmentRepository.merge(
      attachment,
      dto.visibility ? { visibility: dto.visibility } : {},
    );

    return this.toView(await this.attachmentRepository.save(updated));
  }

  async remove(id: string): Promise<void> {
    const attachment = await this.findOne(id);
    const user = useRequestUser();
    this.assertCanManage(attachment, user);
    this.assertNotBoundBusiness(attachment);

    await this.attachmentRepository.softRemove(attachment);
  }

  async bindUserAvatar(
    userId: string,
    attachmentId: string,
    manager: EntityManager,
  ): Promise<string> {
    const user = useRequestUser();
    const repository = manager.getRepository(Attachment);

    if (user.id !== userId && !this.isSuperAdmin(user)) {
      throw new AttachmentException(AttachmentExceptionCode.FORBIDDEN);
    }

    const attachment = await this.findOne(attachmentId, manager);

    if (attachment.uploadedBy?.id !== user.id && !this.isSuperAdmin(user)) {
      throw new AttachmentException(AttachmentExceptionCode.FORBIDDEN);
    }

    this.validateFile(
      {
        mimetype: attachment.mimeType,
        size: attachment.size,
      } as Express.Multer.File,
      MAX_AVATAR_SIZE,
      AVATAR_MIME_TYPES,
    );

    const isBoundToTargetAvatar =
      attachment.bizType === ATTACHMENT_BIZ_TYPE.USER_AVATAR &&
      attachment.bizId === userId;

    // NOTE: 附件已绑定其他业务时禁止抢占，否则原业务记录与附件绑定会不一致
    if (attachment.bizType !== null && !isBoundToTargetAvatar) {
      throw new AttachmentException(AttachmentExceptionCode.ALREADY_BOUND);
    }

    const oldAttachments = await repository.find({
      where: {
        bizType: ATTACHMENT_BIZ_TYPE.USER_AVATAR,
        bizId: userId,
        id: Not(attachmentId),
        deletedAt: IsNull(),
      },
    });

    const result = await repository.update(
      {
        id: attachmentId,
        deletedAt: IsNull(),
        ...(isBoundToTargetAvatar
          ? {
              bizType: ATTACHMENT_BIZ_TYPE.USER_AVATAR,
              bizId: userId,
            }
          : { bizType: IsNull(), bizId: IsNull() }),
      },
      {
        visibility: ATTACHMENT_VISIBILITY.PUBLIC,
        bizType: ATTACHMENT_BIZ_TYPE.USER_AVATAR,
        bizId: userId,
      },
    );

    if (result.affected !== 1) {
      throw new AttachmentException(
        attachment.bizType !== null && !isBoundToTargetAvatar
          ? AttachmentExceptionCode.ALREADY_BOUND
          : AttachmentExceptionCode.NOT_FOUND,
      );
    }

    if (oldAttachments.length > 0) {
      await repository.softRemove(oldAttachments);
    }

    const saved = await repository.findOne({
      where: { id: attachmentId, deletedAt: IsNull() },
      relations: { uploadedBy: true },
    });

    if (!saved) {
      throw new AttachmentException(AttachmentExceptionCode.NOT_FOUND);
    }

    return this.toView(saved).url;
  }

  private validateFile(
    file: Express.Multer.File,
    maxSize: number,
    allowedMimeTypes: readonly string[],
  ) {
    if (file.size > maxSize) {
      throw new AttachmentException(AttachmentExceptionCode.FILE_TOO_LARGE);
    }

    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new AttachmentException(
        AttachmentExceptionCode.MIME_TYPE_NOT_ALLOWED,
      );
    }
  }

  private async readStoredFile(attachment: Attachment) {
    try {
      return await this.storage.read(attachment.storageKey);
    } catch {
      throw new AttachmentException(AttachmentExceptionCode.NOT_FOUND);
    }
  }

  private assertCanAccessPrivate(attachment: Attachment, user: User) {
    if (attachment.visibility === ATTACHMENT_VISIBILITY.PUBLIC) {
      return;
    }

    if (attachment.uploadedBy?.id !== user.id && !this.isSuperAdmin(user)) {
      throw new AttachmentException(AttachmentExceptionCode.FORBIDDEN);
    }
  }

  private assertCanManage(attachment: Attachment, user: User) {
    if (attachment.uploadedBy?.id !== user.id && !this.isSuperAdmin(user)) {
      throw new AttachmentException(AttachmentExceptionCode.FORBIDDEN);
    }
  }

  private assertNotBoundAvatar(attachment: Attachment) {
    if (attachment.bizType === ATTACHMENT_BIZ_TYPE.USER_AVATAR) {
      throw new AttachmentException(AttachmentExceptionCode.IN_USE);
    }
  }

  private assertNotBoundBusiness(attachment: Attachment) {
    if (attachment.bizType) {
      throw new AttachmentException(AttachmentExceptionCode.IN_USE);
    }
  }

  private isSuperAdmin(user: User) {
    return user.specialRoles?.includes(SpecialRolesEnum.SuperAdmin) ?? false;
  }

  private toView(attachment: Attachment): IAttachmentView {
    const baseUrl = `${this.signatureService.getUrlPrefix()}/${attachment.id}`;

    return {
      id: attachment.id,
      originalName: attachment.originalName,
      mimeType: attachment.mimeType,
      size: attachment.size,
      visibility: attachment.visibility,
      storageProvider: attachment.storageProvider,
      bizType: attachment.bizType,
      bizId: attachment.bizId,
      url: baseUrl,
      createdAt: attachment.createdAt,
    };
  }
}
