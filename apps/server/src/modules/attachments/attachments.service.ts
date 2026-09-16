import { useRequestUser } from '@/common/context/user-context';
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
  IsNull,
  Not,
  Repository,
} from 'typeorm';
import { AttachmentSignatureService } from './attachment-signature.service';
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
    @Inject(ATTACHMENT_STORAGE)
    private readonly storage: IAttachmentStorage,
    private readonly signatureService: AttachmentSignatureService,
  ) {}

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
          originalName: file.originalname,
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

  async findOne(id: string, manager?: EntityManager): Promise<Attachment> {
    const repository =
      manager?.getRepository(Attachment) ?? this.attachmentRepository;
    const attachment = await repository.findOne({
      where: { id },
      relations: { uploadedBy: true },
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

  async getContent(
    id: string,
    expiresAt?: string,
    userId?: string,
    signature?: string,
  ): Promise<{ attachment: Attachment; content: IReadableStoredFile }> {
    const attachment = await this.findOne(id);

    if (attachment.visibility === ATTACHMENT_VISIBILITY.PUBLIC) {
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
    );

    if (!valid) {
      throw new AttachmentException(AttachmentExceptionCode.INVALID_SIGNATURE);
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

    const updated = this.attachmentRepository.merge(attachment, dto);

    return this.toView(await this.attachmentRepository.save(updated));
  }

  async remove(id: string): Promise<void> {
    const attachment = await this.findOne(id);
    const user = useRequestUser();
    this.assertCanManage(attachment, user);
    this.assertNotBoundAvatar(attachment);

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

    const oldAttachments = await repository.find({
      where: {
        bizType: ATTACHMENT_BIZ_TYPE.USER_AVATAR,
        bizId: userId,
        id: Not(attachmentId),
        deletedAt: IsNull(),
      },
    });

    const updated = repository.merge(attachment, {
      visibility: ATTACHMENT_VISIBILITY.PUBLIC,
      bizType: ATTACHMENT_BIZ_TYPE.USER_AVATAR,
      bizId: userId,
    });

    const saved = await repository.save(updated);

    if (oldAttachments.length > 0) {
      await repository.softRemove(oldAttachments);
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
