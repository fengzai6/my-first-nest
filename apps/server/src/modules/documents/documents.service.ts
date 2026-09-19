import { SpecialRolesEnum } from '@/common/decorators/special-roles.decorator';
import { RoleCode } from '@/common/constants/roles';
import {
  DocumentException,
  DocumentExceptionCode,
} from '@/common/exceptions/document.exception';
import {
  AttachmentException,
  AttachmentExceptionCode,
} from '@/common/exceptions/attachment.exception';
import { IAttachmentView } from '@/modules/attachments/attachments.service';
import { AttachmentsService } from '@/modules/attachments/attachments.service';
import { ATTACHMENT_BIZ_TYPE } from '@/modules/attachments/constants/attachment.constants';
import { RolesService } from '@/modules/roles/roles.service';
import { User } from '@/modules/users/entities/user.entity';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, Repository } from 'typeorm';
import {
  DOCUMENT_STATUS,
  DocumentStatus,
} from './constants/document.constants';
import { CreateDocumentDto } from './dto/create-document.dto';
import { FindDocumentsDto } from './dto/find-documents.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
import { Document } from './entities/document.entity';

export interface IDocumentView {
  id: string;
  title: string;
  content: string;
  status: DocumentStatus;
  owner: { id: string; displayName: string };
  attachments: IAttachmentView[];
  createdAt: Date;
  updatedAt: Date;
}

export interface IDocumentListItem {
  id: string;
  title: string;
  status: DocumentStatus;
  owner: { id: string; displayName: string };
  attachmentCount: number;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class DocumentsService {
  constructor(
    @InjectRepository(Document)
    private readonly documentRepository: Repository<Document>,
    private readonly dataSource: DataSource,
    private readonly rolesService: RolesService,
    private readonly attachmentsService: AttachmentsService,
  ) {}

  async create(dto: CreateDocumentDto, user: User): Promise<IDocumentView> {
    const documentId = await this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(Document);
      const document = await repository.save(
        repository.create({
          title: dto.title,
          content: dto.content,
          status: dto.status ?? DOCUMENT_STATUS.DRAFT,
          owner: user,
        }),
      );

      await this.attachmentsService.syncDocumentAttachments(
        document.id,
        dto.attachmentIds ?? [],
        manager,
        user,
      );

      return document.id;
    });

    return this.findOne(documentId, user);
  }

  async findAll(queryDto: FindDocumentsDto, user: User) {
    const page = queryDto.page ?? 1;
    const pageSize = queryDto.pageSize ?? 20;
    const query = this.documentRepository
      .createQueryBuilder('document')
      .leftJoinAndSelect('document.owner', 'owner')
      .withDeleted()
      .andWhere('document.deletedAt IS NULL');

    if (queryDto.status) {
      query.andWhere('document.status = :status', {
        status: queryDto.status,
      });
    }
    if (queryDto.keyword) {
      query.andWhere('document.title ILIKE :keyword', {
        keyword: `%${queryDto.keyword}%`,
      });
    }
    if (!this.isSuperAdmin(user) && !(await this.isAdmin(user.id))) {
      query.andWhere('owner.id = :userId', { userId: user.id });
    }

    query
      .orderBy('document.createdAt', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize);

    const [documents, total] = await query.getManyAndCount();
    const counts = await this.attachmentsService.countActiveByBusiness(
      ATTACHMENT_BIZ_TYPE.DOCUMENT,
      documents.map((document) => document.id),
    );

    return {
      list: documents.map(
        (document): IDocumentListItem => ({
          id: document.id,
          title: document.title,
          status: document.status,
          owner: {
            id: document.owner?.id ?? '',
            displayName: document.owner?.displayName ?? '已删除用户',
          },
          attachmentCount: counts.get(document.id) ?? 0,
          createdAt: document.createdAt,
          updatedAt: document.updatedAt,
        }),
      ),
      total,
      page,
      pageSize,
    };
  }

  async findOne(id: string, user: User): Promise<IDocumentView> {
    const document = await this.findOneEntity(id, user);
    const attachments = await this.attachmentsService.findByBusiness(
      ATTACHMENT_BIZ_TYPE.DOCUMENT,
      document.id,
    );

    return this.toView(document, attachments);
  }

  async update(
    id: string,
    dto: UpdateDocumentDto,
    user: User,
  ): Promise<IDocumentView> {
    const current = await this.findOneEntity(id, user);
    const { attachmentIds, ...fields } = dto;

    await this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(Document);
      const updated = repository.merge(current, fields);
      await repository.save(updated);

      if (attachmentIds !== undefined) {
        await this.attachmentsService.syncDocumentAttachments(
          id,
          attachmentIds,
          manager,
          user,
        );
      }
    });

    return this.findOne(id, user);
  }

  async remove(id: string, user: User): Promise<void> {
    const document = await this.findOneEntity(id, user);

    await this.dataSource.transaction(async (manager) => {
      await manager.getRepository(Document).softRemove(document);
      await this.attachmentsService.softRemoveByBusiness(
        ATTACHMENT_BIZ_TYPE.DOCUMENT,
        document.id,
        manager,
      );
    });
  }

  async createAttachmentSignedUrl(
    documentId: string,
    attachmentId: string,
    user: User,
  ): Promise<{ url: string; expiresAt: number }> {
    await this.findOneEntity(documentId, user);
    const attachment = await this.attachmentsService.findOne(attachmentId);

    if (
      attachment.bizType !== ATTACHMENT_BIZ_TYPE.DOCUMENT ||
      attachment.bizId !== documentId
    ) {
      throw new AttachmentException(AttachmentExceptionCode.NOT_FOUND);
    }

    return this.attachmentsService.createSignedUrlForUser(
      attachmentId,
      user.id,
    );
  }

  private async findOneEntity(id: string, user: User): Promise<Document> {
    const document = await this.documentRepository.findOne({
      where: { id, deletedAt: IsNull() },
      relations: { owner: true },
      withDeleted: true,
    });

    if (!document) {
      throw new DocumentException(DocumentExceptionCode.NOT_FOUND);
    }

    await this.assertCanManage(document, user);
    return document;
  }

  private async assertCanManage(document: Document, user: User) {
    if (this.isSuperAdmin(user)) return;
    if (document.owner.id === user.id) return;
    if (await this.isAdmin(user.id)) return;

    throw new DocumentException(DocumentExceptionCode.FORBIDDEN);
  }

  private async isAdmin(userId: string): Promise<boolean> {
    const roles = await this.rolesService.findByUser(userId);
    return roles.some((role) => role.code === RoleCode.ADMIN);
  }

  private isSuperAdmin(user: User) {
    return user.specialRoles?.includes(SpecialRolesEnum.SuperAdmin) ?? false;
  }

  private toView(
    document: Document,
    attachments: IAttachmentView[],
  ): IDocumentView {
    return {
      id: document.id,
      title: document.title,
      content: document.content,
      status: document.status,
      owner: {
        id: document.owner?.id ?? '',
        displayName: document.owner?.displayName ?? '已删除用户',
      },
      attachments,
      createdAt: document.createdAt,
      updatedAt: document.updatedAt,
    };
  }
}
