# 资料文档附件业务闭环 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新增资料文档业务模块，跑通文档权限、`bizType/bizId` 附件绑定、文档附件签名、文档删除和前端完整 CRUD 流程。

**Architecture:** 文档模块先完成 owner / admin 权限校验，再通过 `AttachmentsService` 在同一个数据库事务中同步附件集合。附件仍使用通用上传接口，文档保存时把未绑定附件绑定为 `bizType = document`、`bizId = document.id`，移除的旧附件只软删除元数据。前端文档页面复用 `AttachmentUpload`，文档详情通过文档权限签发私有附件 URL。

**Tech Stack:** NestJS 11、TypeORM、PostgreSQL、class-validator、Swagger、Vitest、React 19、Ant Design 6、TanStack Query、React Router 7。

**Spec:** [2026-09-16-document-attachment-workflow-design.md](../specs/2026-09-16-document-attachment-workflow-design.md)

## Global Constraints

- 响应统一使用简体中文。
- 文件/目录使用 kebab-case；React 组件使用命名导出。
- 新增权限码固定为 `document:create`、`document:read`、`document:update`、`document:delete`。
- `admin` 和 `user` 默认拥有全部文档权限；超级管理员继续通过 `SpecialRolesEnum.SuperAdmin` 绕过 RBAC 和 owner 校验。
- 普通用户只能列表、查看、更新和删除自己的文档；管理员和超级管理员可以操作全部文档。
- 文档附件使用 `bizType = document`、`bizId = document.id`，不新增附件关联表。
- 创建和更新文档时，`attachmentIds` 表示完整附件集合；未传表示不修改，空数组表示移除全部。
- 文档保存、附件绑定和被移除附件软删除必须在同一个数据库事务中完成。
- 已绑定文档的附件禁止通用删除和头像绑定；通用更新只允许改变 `visibility`。
- 文档附件默认私有；上传者可以显式设为公开。公开附件可直接读取，私有附件通过文档权限签名。
- 文档删除只软删除文档和当前绑定附件，不删除物理文件。
- 前端不引入 `flyfish-dev/file-viewer`；图片继续使用 Ant Design `Image`，其他文件使用图标。
- `AttachmentUpload` 删除失败时保留当前列表并显示错误，不做乐观移除。
- 本计划与 [2026-09-16-attachment-cleanup-job.md](./2026-09-16-attachment-cleanup-job.md) 都会修改附件 service 和 entity。推荐先执行本计划，再执行清理计划；反向执行时必须保留双方接口。
- 本计划不执行 `git add`、`git commit`、`git push`、建分支或开 PR。每个任务以测试或构建验证收口，用户明确要求后再提交。

---

## File Structure

**服务端新增**

- `apps/server/src/modules/documents/documents.module.ts`：文档模块组装。
- `apps/server/src/modules/documents/documents.controller.ts`：文档 HTTP 路由和权限装饰器。
- `apps/server/src/modules/documents/documents.service.ts`：文档 CRUD、owner 权限、附件同步和事务控制。
- `apps/server/src/modules/documents/constants/document.constants.ts`：文档状态和业务类型常量。
- `apps/server/src/modules/documents/dto/create-document.dto.ts`：创建文档入参。
- `apps/server/src/modules/documents/dto/update-document.dto.ts`：更新文档入参。
- `apps/server/src/modules/documents/dto/find-documents.dto.ts`：文档分页查询入参。
- `apps/server/src/modules/documents/dto/signed-attachment-url.dto.ts`：文档附件签名响应。
- `apps/server/src/modules/documents/entities/document.entity.ts`：文档实体。
- `apps/server/src/modules/documents/README.md`：模块设计和业务闭环说明。
- `apps/server/src/common/constants/permissions/documents.permission.ts`：文档权限定义。
- `apps/server/src/common/exceptions/document.exception.ts`：文档错误码和响应映射。
- `apps/server/database/migrations/20260916100000-create-documents.ts`：创建文档表、外键和索引。

**服务端修改**

- `apps/server/src/common/constants/permissions/index.ts`：合并并导出文档权限。
- `apps/server/src/common/constants/roles.ts`：给 `user` 角色补文档权限。
- `apps/server/src/modules/attachments/constants/attachment.constants.ts`：增加 `document` 业务类型。
- `apps/server/src/modules/attachments/attachments.service.ts`：增加文档附件同步、业务软删除、文档签名和通用操作限制。
- `apps/server/src/modules/attachments/attachments.module.ts`：保持 `AttachmentsService` 对外导出。
- `apps/server/src/modules/index.ts`：注册 `DocumentsModule`。

**前端新增**

- `apps/web/src/services/types/document.ts`：文档类型。
- `apps/web/src/services/dtos/document.ts`：文档 DTO。
- `apps/web/src/services/api/document.ts`：文档 API。
- `apps/web/src/pages/documents/index.tsx`：文档列表、创建、编辑、详情和删除入口。
- `apps/web/src/pages/documents/components/document-form.tsx`：创建 / 编辑表单。
- `apps/web/src/pages/documents/components/document-detail.tsx`：详情展示。
- `apps/web/src/pages/documents/components/document-attachments.tsx`：文档附件列表和签名预览。

**前端修改**

- `apps/web/src/components/attachment-upload/index.tsx`：支持自定义签名 URL，并处理删除失败。
- `apps/web/src/components/attachment-upload/attachment-preview.tsx`：支持调用文档附件签名接口。
- `apps/web/src/router/routes.tsx`：增加 `/documents` 路由。
- `apps/web/src/components/app-sidebar/index.tsx`：增加“资料文档”导航。

**测试新增或修改**

- `apps/server/tests/unit/modules/attachments/attachments.service.spec.ts`
- `apps/server/tests/unit/modules/documents/documents.service.spec.ts`
- `apps/server/tests/e2e/documents.e2e-spec.ts`
- `apps/web/src/services/api/__tests__/document.test.ts`

---

### Task 1: 文档权限、实体和数据库迁移

**Files:**

- Create: `apps/server/src/common/constants/permissions/documents.permission.ts`
- Create: `apps/server/src/common/exceptions/document.exception.ts`
- Create: `apps/server/src/modules/documents/constants/document.constants.ts`
- Create: `apps/server/src/modules/documents/entities/document.entity.ts`
- Create: `apps/server/database/migrations/20260916100000-create-documents.ts`
- Modify: `apps/server/src/common/constants/permissions/index.ts`
- Modify: `apps/server/src/common/constants/roles.ts`

**Interfaces:**

- Consumes: `BaseEntity` 提供 `id`、`createdAt`、`updatedAt`、`deletedAt`；`User` 提供文档 owner 关系。
- Produces: `DOCUMENT_STATUS`、`DocumentStatus`、`Document`、`DocumentExceptionCode`、`DocumentException`、`DOCUMENTS_PERMISSIONS`。

创建 `documents.permission.ts`：

```ts
import { CreatePermissionDto } from '@/modules/permissions/dto/create-permission.dto';

export const DocumentsPermissionCode = {
  DOCUMENT_CREATE: 'document:create',
  DOCUMENT_READ: 'document:read',
  DOCUMENT_UPDATE: 'document:update',
  DOCUMENT_DELETE: 'document:delete',
} as const;

export const DOCUMENTS_PERMISSIONS: CreatePermissionDto[] = [
  { name: '创建资料文档', code: DocumentsPermissionCode.DOCUMENT_CREATE },
  { name: '读取资料文档', code: DocumentsPermissionCode.DOCUMENT_READ },
  { name: '更新资料文档', code: DocumentsPermissionCode.DOCUMENT_UPDATE },
  { name: '删除资料文档', code: DocumentsPermissionCode.DOCUMENT_DELETE },
];
```

创建 `document.constants.ts`：

```ts
export const DOCUMENT_STATUS = {
  DRAFT: 'draft',
  PUBLISHED: 'published',
} as const;

export type DocumentStatus =
  (typeof DOCUMENT_STATUS)[keyof typeof DOCUMENT_STATUS];
```

创建 `Document`：

```ts
@Entity('documents')
@Index(['owner', 'deletedAt', 'createdAt'])
@Index(['status', 'deletedAt', 'createdAt'])
export class Document extends BaseEntity {
  @Column({ length: 200 })
  title: string;

  @Column({ type: 'text' })
  content: string;

  @Column({
    type: 'varchar',
    length: 16,
    default: DOCUMENT_STATUS.DRAFT,
  })
  status: DocumentStatus;

  @ManyToOne(() => User, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'owner_id' })
  owner: User;
}
```

创建 `DocumentExceptionCode`：

```ts
export const DocumentExceptionCode = {
  NOT_FOUND: 'DOCUMENT_NOT_FOUND',
  FORBIDDEN: 'DOCUMENT_FORBIDDEN',
} as const;
```

错误状态固定为：

```ts
[DocumentExceptionCode.NOT_FOUND]: {
  message: '资料文档不存在',
  status: HttpStatus.NOT_FOUND,
  code: DocumentExceptionCode.NOT_FOUND,
},
[DocumentExceptionCode.FORBIDDEN]: {
  message: '没有权限操作该资料文档',
  status: HttpStatus.FORBIDDEN,
  code: DocumentExceptionCode.FORBIDDEN,
},
```

- [ ] **Step 1: 新增文档权限和角色分配**

在 `permissions/index.ts` 中导入 `DOCUMENTS_PERMISSIONS` 和 `DocumentsPermissionCode`，并加入 `PermissionCode` 和 `PERMISSIONS`。

在 `roles.ts` 中把 `user` 角色权限改为：

```ts
permissions: [...USERS_PERMISSIONS, ...DOCUMENTS_PERMISSIONS],
```

`admin` 继续使用全部 `PERMISSIONS`。

- [ ] **Step 2: 新增文档实体和错误类型**

按上面的实体结构创建 `document.entity.ts`，并按既有 `AttachmentException` 模式创建 `document.exception.ts`。

- [ ] **Step 3: 新增迁移**

迁移文件 `up()` 执行：

```sql
CREATE TABLE "documents" (
  "id" bigint NOT NULL,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
  "deleted_at" TIMESTAMP,
  "title" character varying(200) NOT NULL,
  "content" text NOT NULL,
  "status" character varying(16) NOT NULL DEFAULT 'draft',
  "owner_id" bigint NOT NULL,
  CONSTRAINT "PK_documents_id" PRIMARY KEY ("id")
);

CREATE INDEX "IDX_documents_owner_created"
  ON "documents" ("owner_id", "deleted_at", "created_at");

CREATE INDEX "IDX_documents_status_created"
  ON "documents" ("status", "deleted_at", "created_at");

ALTER TABLE "documents"
  ADD CONSTRAINT "FK_documents_owner"
  FOREIGN KEY ("owner_id") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE NO ACTION;
```

`down()` 按外键、索引、表的顺序删除。

- [ ] **Step 4: 验证类型和迁移**

Run:

```bash
yarn workspace @my-first-nest/server type-check
yarn workspace @my-first-nest/server db:migrate
yarn workspace @my-first-nest/server db:seed
```

Expected: 类型检查通过；迁移和种子数据执行成功。若本地数据库未启动，只运行 `type-check`，并在手工验收前完成迁移和 seed。

---

### Task 2: 附件文档绑定、签名和通用操作限制

**Files:**

- Modify: `apps/server/src/modules/attachments/constants/attachment.constants.ts`
- Modify: `apps/server/src/modules/attachments/attachments.service.ts`
- Modify: `apps/server/tests/unit/modules/attachments/attachments.service.spec.ts`

**Interfaces:**

- Consumes: 文档 ID、完整附件 ID 集合和 TypeORM `EntityManager`。
- Produces:

```ts
syncDocumentAttachments(
  documentId: string,
  attachmentIds: string[],
  manager: EntityManager,
): Promise<void>;

softRemoveByBusiness(
  bizType: string,
  bizId: string,
  manager: EntityManager,
): Promise<void>;

createSignedUrlForUser(
  attachmentId: string,
  userId: string,
): Promise<{ url: string; expiresAt: number }>;

countActiveByBusiness(
  bizType: string,
  bizIds: string[],
): Promise<Map<string, number>>;
```

- 文档绑定逻辑由 `DocumentsService` 完成 owner / admin 权限校验后调用，附件 service 不再次读取请求上下文。

在 `attachment.constants.ts` 增加：

```ts
export const ATTACHMENT_BIZ_TYPE = {
  USER_AVATAR: 'user-avatar',
  DOCUMENT: 'document',
} as const;
```

`syncDocumentAttachments()` 完整行为：

```ts
async syncDocumentAttachments(
  documentId: string,
  attachmentIds: string[],
  manager: EntityManager,
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
      : await repository.find({ where: { id: In(uniqueIds) } });

  if (requested.length !== uniqueIds.length) {
    throw new AttachmentException(AttachmentExceptionCode.NOT_FOUND);
  }

  for (const attachment of requested) {
    const isCurrentDocument =
      attachment.bizType === ATTACHMENT_BIZ_TYPE.DOCUMENT &&
      attachment.bizId === documentId;
    if (attachment.bizType && !isCurrentDocument) {
      throw new AttachmentException(AttachmentExceptionCode.IN_USE);
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
    attachment.bizType = ATTACHMENT_BIZ_TYPE.DOCUMENT;
    attachment.bizId = documentId;
  }

  if (added.length > 0) {
    await repository.save(added);
  }
  if (removed.length > 0) {
    await repository.softRemove(removed);
  }
}
```

`softRemoveByBusiness()`：

```ts
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
```

`createSignedUrlForUser()` 只签发 URL，不读取请求上下文：

```ts
async createSignedUrlForUser(
  attachmentId: string,
  userId: string,
): Promise<{ url: string; expiresAt: number }> {
  await this.findOne(attachmentId);
  return this.signatureService.createSignedUrl(attachmentId, userId);
}
```

`countActiveByBusiness()` 使用一次分组查询，避免列表 N+1：

```ts
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
```

通用接口限制：

- `remove()` 对任何 `bizType !== null` 的附件抛 `ATTACHMENT_IN_USE`。
- `bindUserAvatar()` 仅允许绑定未绑定附件，或当前用户自己的头像附件。
- `update()` 继续只接收 `visibility`；`user-avatar` 抛 `ATTACHMENT_IN_USE`，`document` 允许修改 `visibility`。
- `AttachmentExceptionMap[IN_USE].message` 改为“已绑定的附件不能通过通用接口修改或删除”。

- [ ] **Step 1: 先扩展附件单元测试并确认失败**

在 `attachments.service.spec.ts` 增加以下测试：

```ts
it('binds, keeps, and soft removes document attachments as one set', async () => {
  const { service, createManagerMock } = createService();
  const { manager, repository } = createManagerMock();
  const kept = createAttachment({
    id: 'kept-id',
    bizType: ATTACHMENT_BIZ_TYPE.DOCUMENT,
    bizId: 'document-id',
  });
  const removed = createAttachment({
    id: 'removed-id',
    bizType: ATTACHMENT_BIZ_TYPE.DOCUMENT,
    bizId: 'document-id',
  });
  const added = createAttachment({ id: 'added-id' });

  repository.find
    .mockResolvedValueOnce([kept, removed])
    .mockResolvedValueOnce([added]);

  await service.syncDocumentAttachments(
    'document-id',
    ['kept-id', 'added-id'],
    manager,
  );

  expect(added.bizType).toBe(ATTACHMENT_BIZ_TYPE.DOCUMENT);
  expect(added.bizId).toBe('document-id');
  expect(repository.save).toHaveBeenCalledWith([added]);
  expect(repository.softRemove).toHaveBeenCalledWith([removed]);
});

it('rejects binding an attachment owned by another business object', async () => {
  const { service, createManagerMock } = createService();
  const { manager, repository } = createManagerMock();

  repository.find
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([
      createAttachment({
        bizType: ATTACHMENT_BIZ_TYPE.USER_AVATAR,
        bizId: 'user-id',
      }),
    ]);

  await expect(
    service.syncDocumentAttachments('document-id', ['attachment-id'], manager),
  ).rejects.toMatchObject({
    code: AttachmentExceptionCode.IN_USE,
  });
});

it('issues a document-scoped signed url without checking the uploader', async () => {
  const { service, repository, createSignedUrl } = createService();
  repository.findOne.mockResolvedValue(
    createAttachment({ uploadedBy: createUser({ id: 'uploader-id' }) }),
  );

  await expect(
    service.createSignedUrlForUser('attachment-id', 'document-reader-id'),
  ).resolves.toMatchObject({
    url: expect.stringContaining('/api/attachments/content/attachment-id'),
  });
  expect(createSignedUrl).toHaveBeenCalledWith(
    'attachment-id',
    'document-reader-id',
  );
});

it('rejects generic deletion for any bound attachment', async () => {
  const { service, repository } = createService();
  const user = createUser();
  repository.findOne.mockResolvedValue(
    createAttachment({
      uploadedBy: user,
      bizType: ATTACHMENT_BIZ_TYPE.DOCUMENT,
      bizId: 'document-id',
    }),
  );

  await userContextStorage.run(user, async () => {
    await expect(service.remove('attachment-id')).rejects.toMatchObject({
      code: AttachmentExceptionCode.IN_USE,
    });
  });
});
```

Run:

```bash
yarn workspace @my-first-nest/server test tests/unit/modules/attachments/attachments.service.spec.ts
```

Expected: FAIL，提示 `syncDocumentAttachments`、`createSignedUrlForUser` 或 `countActiveByBusiness` 未定义。

- [ ] **Step 2: 实现附件接口**

按上面的接口和实现补充 `attachments.service.ts`，并补充 `In` 导入。

同时将通用操作限制改为：

```ts
private assertNotBoundBusiness(attachment: Attachment) {
  if (attachment.bizType) {
    throw new AttachmentException(AttachmentExceptionCode.IN_USE);
  }
}

private assertNotBoundAvatar(attachment: Attachment) {
  if (attachment.bizType === ATTACHMENT_BIZ_TYPE.USER_AVATAR) {
    throw new AttachmentException(AttachmentExceptionCode.IN_USE);
  }
}
```

`bindUserAvatar()` 在 `validateFile()` 前增加：

```ts
const isCurrentAvatar =
  attachment.bizType === ATTACHMENT_BIZ_TYPE.USER_AVATAR &&
  attachment.bizId === userId;

if (attachment.bizType && !isCurrentAvatar) {
  throw new AttachmentException(AttachmentExceptionCode.IN_USE);
}
```

- [ ] **Step 3: 运行附件测试**

Run:

```bash
yarn workspace @my-first-nest/server test tests/unit/modules/attachments/attachments.service.spec.ts
```

Expected: PASS，既有头像测试和新文档绑定测试全部通过。

---

### Task 3: 文档 DTO、Service 和事务行为

**Files:**

- Create: `apps/server/src/modules/documents/dto/create-document.dto.ts`
- Create: `apps/server/src/modules/documents/dto/update-document.dto.ts`
- Create: `apps/server/src/modules/documents/dto/find-documents.dto.ts`
- Create: `apps/server/src/modules/documents/dto/signed-attachment-url.dto.ts`
- Create: `apps/server/src/modules/documents/documents.service.ts`
- Create: `apps/server/tests/unit/modules/documents/documents.service.spec.ts`

**Interfaces:**

- Consumes: `Document`、`AttachmentsService.syncDocumentAttachments()`、`AttachmentsService.softRemoveByBusiness()`、`AttachmentsService.findByBusiness()`、`AttachmentsService.countActiveByBusiness()`、`AttachmentsService.createSignedUrlForUser()`、`RolesService.findByUser()`。
- Produces:

```ts
interface IDocumentView {
  id: string;
  title: string;
  content: string;
  status: DocumentStatus;
  owner: { id: string; displayName: string };
  attachments: IAttachmentView[];
  createdAt: Date;
  updatedAt: Date;
}

interface IDocumentListItem {
  id: string;
  title: string;
  status: DocumentStatus;
  owner: { id: string; displayName: string };
  attachmentCount: number;
  createdAt: Date;
  updatedAt: Date;
}

create(dto: CreateDocumentDto, user: User): Promise<IDocumentView>;
findAll(query: FindDocumentsDto, user: User): Promise<{
  list: IDocumentListItem[];
  total: number;
  page: number;
  pageSize: number;
}>;
findOne(id: string, user: User): Promise<IDocumentView>;
update(id: string, dto: UpdateDocumentDto, user: User): Promise<IDocumentView>;
remove(id: string, user: User): Promise<void>;
createAttachmentSignedUrl(
  documentId: string,
  attachmentId: string,
  user: User,
): Promise<{ url: string; expiresAt: number }>;
findOneEntity(id: string, user: User): Promise<Document>;
```

DTO：

```ts
export class CreateDocumentDto {
  @ApiProperty({ maxLength: 200 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;

  @ApiProperty()
  @IsString()
  content: string;

  @ApiPropertyOptional({ enum: Object.values(DOCUMENT_STATUS) })
  @IsOptional()
  @IsEnum(DOCUMENT_STATUS)
  status?: DocumentStatus;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(MAX_ATTACHMENT_COUNT)
  @IsString({ each: true })
  attachmentIds?: string[];
}

export class UpdateDocumentDto extends PartialType(CreateDocumentDto) {}
```

`FindDocumentsDto` 使用：

- `page` 默认 1，最小 1。
- `pageSize` 默认 20，最大 100。
- `status` 可选，使用 `@IsEnum(DOCUMENT_STATUS)`。
- `keyword` 可选，最大 200 字符。

- [ ] **Step 1: 编写文档 service 失败测试**

创建 `documents.service.spec.ts`，覆盖：

```ts
it('creates a document and binds attachments in one transaction', async () => {
  const { service, dataSource, documentsRepository, syncDocumentAttachments } =
    createService();
  const user = createUser();
  const document = createDocument({ owner: user });

  documentsRepository.save.mockResolvedValue(document);

  await service.create(
    {
      title: '学习记录',
      content: '正文',
      attachmentIds: ['attachment-id'],
    },
    user,
  );

  expect(dataSource.transaction).toHaveBeenCalledTimes(1);
  expect(syncDocumentAttachments).toHaveBeenCalledWith(
    'document-id',
    ['attachment-id'],
    expect.anything(),
  );
});

it('rejects another ordinary user before returning a document', async () => {
  const { service, documentsRepository, rolesService } = createService();
  const owner = createUser({ id: 'owner-id' });
  const other = createUser({ id: 'other-id' });
  documentsRepository.findOne.mockResolvedValue(
    createDocument({ owner }),
  );
  rolesService.findByUser.mockResolvedValue([createRole(RoleCode.USER)]);

  await expect(service.findOne('document-id', other)).rejects.toMatchObject({
    code: DocumentExceptionCode.FORBIDDEN,
  });
});

it('soft removes the document and its attachments in one transaction', async () => {
  const { service, documentsRepository, softRemoveByBusiness } = createService();
  const owner = createUser();
  documentsRepository.findOne.mockResolvedValue(
    createDocument({ owner }),
  );

  await service.remove('document-id', owner);

  expect(documentsRepository.softRemove).toHaveBeenCalledWith(
    expect.objectContaining({ id: 'document-id' }),
  );
  expect(softRemoveByBusiness).toHaveBeenCalledWith(
    ATTACHMENT_BIZ_TYPE.DOCUMENT,
    'document-id',
    expect.anything(),
  );
});
```

Run:

```bash
yarn workspace @my-first-nest/server test tests/unit/modules/documents/documents.service.spec.ts
```

Expected: FAIL，模块和 service 尚不存在。

- [ ] **Step 2: 实现 owner / admin 权限判断**

`isAdmin(userId)`：

```ts
private async isAdmin(userId: string): Promise<boolean> {
  const roles = await this.rolesService.findByUser(userId);
  return roles.some((role) => role.code === RoleCode.ADMIN);
}
```

`assertCanManage(document, user)`：

```ts
private async assertCanManage(document: Document, user: User) {
  if (this.isSuperAdmin(user)) return;
  if (document.owner.id === user.id) return;
  if (await this.isAdmin(user.id)) return;

  throw new DocumentException(DocumentExceptionCode.FORBIDDEN);
}
```

`isSuperAdmin()` 与附件 service 一致，使用 `SpecialRolesEnum.SuperAdmin`。

`findOneEntity()` 必须显式加载 owner，否则 `document.owner.id` 无法参与权限判断：

```ts
private async findOneEntity(id: string, user: User): Promise<Document> {
  const document = await this.documentRepository.findOne({
    where: { id },
    relations: { owner: true },
  });

  if (!document) {
    throw new DocumentException(DocumentExceptionCode.NOT_FOUND);
  }

  await this.assertCanManage(document, user);
  return document;
}
```

- [ ] **Step 3: 实现 CRUD 和事务**

创建文档：

```ts
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
    );

    return document.id;
  });

  return this.findOne(documentId, user);
}
```

更新文档：

```ts
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
      );
    }
  });

  return this.findOne(id, user);
}
```

删除文档：

```ts
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
```

- [ ] **Step 4: 实现列表、详情和签名**

列表查询使用 query builder：

```ts
const query = this.documentRepository
  .createQueryBuilder('document')
  .leftJoinAndSelect('document.owner', 'owner');

if (queryDto.status) {
  query.andWhere('document.status = :status', { status: queryDto.status });
}
if (queryDto.keyword) {
  query.andWhere('document.title ILIKE :keyword', {
    keyword: `%${queryDto.keyword}%`,
  });
}
if (!(await this.isAdmin(user.id)) && !this.isSuperAdmin(user)) {
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
```

详情视图必须由文档权限校验后查询附件：

```ts
async findOne(id: string, user: User): Promise<IDocumentView> {
  const document = await this.findOneEntity(id, user);
  const attachments = await this.attachmentsService.findByBusiness(
    ATTACHMENT_BIZ_TYPE.DOCUMENT,
    document.id,
  );

  return this.toView(document, attachments);
}
```

文档附件签名：

```ts
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
```

- [ ] **Step 5: 运行文档 service 测试**

Run:

```bash
yarn workspace @my-first-nest/server test tests/unit/modules/documents/documents.service.spec.ts
```

Expected: PASS。确认测试断言附件查询发生在权限校验之后。

---

### Task 4: 文档 HTTP 接口和 e2e 闭环

**Files:**

- Create: `apps/server/src/modules/documents/documents.controller.ts`
- Create: `apps/server/src/modules/documents/documents.module.ts`
- Create: `apps/server/tests/e2e/documents.e2e-spec.ts`
- Modify: `apps/server/src/modules/index.ts`

**Interfaces:**

- Consumes: `DocumentsService` 的 Task 3 方法。
- Produces: `GET/POST/PATCH/DELETE /api/documents`、`GET /api/documents/:documentId/attachments/:attachmentId/signed-url`。

Controller 路由：

```ts
@ApiTags('Documents - 资料文档')
@ApiBearerAuth()
@Controller('documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Post()
  @Permission(PermissionCode.DOCUMENT_CREATE)
  create(
    @Body() dto: CreateDocumentDto,
    @UserInfo() user: User,
  ) {
    return this.documentsService.create(dto, user);
  }

  @Get()
  @Permission(PermissionCode.DOCUMENT_READ)
  findAll(
    @Query() query: FindDocumentsDto,
    @UserInfo() user: User,
  ) {
    return this.documentsService.findAll(query, user);
  }

  @Get(':id')
  @Permission(PermissionCode.DOCUMENT_READ)
  findOne(@Param('id') id: string, @UserInfo() user: User) {
    return this.documentsService.findOne(id, user);
  }

  @Patch(':id')
  @Permission(PermissionCode.DOCUMENT_UPDATE)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateDocumentDto,
    @UserInfo() user: User,
  ) {
    return this.documentsService.update(id, dto, user);
  }

  @Delete(':id')
  @Permission(PermissionCode.DOCUMENT_DELETE)
  async remove(@Param('id') id: string, @UserInfo() user: User) {
    await this.documentsService.remove(id, user);
  }

  @Get(':documentId/attachments/:attachmentId/signed-url')
  @Permission(PermissionCode.DOCUMENT_READ)
  getAttachmentSignedUrl(
    @Param('documentId') documentId: string,
    @Param('attachmentId') attachmentId: string,
    @UserInfo() user: User,
  ) {
    return this.documentsService.createAttachmentSignedUrl(
      documentId,
      attachmentId,
      user,
    );
  }
}
```

模块：

```ts
@Module({
  imports: [
    TypeOrmModule.forFeature([Document]),
    AttachmentsModule,
    RolesModule,
  ],
  controllers: [DocumentsController],
  providers: [DocumentsService],
  exports: [DocumentsService],
})
export class DocumentsModule {}
```

在 `modules/index.ts` 的 `modules` 数组中加入 `DocumentsModule`。

- [ ] **Step 1: 编写 e2e 测试**

`documents.e2e-spec.ts` 至少覆盖：

```ts
it('creates a document with an uploaded private attachment', async () => {
  const upload = await request(helper.getHttpServer())
    .post('/api/attachments')
    .set('Authorization', `Bearer ${accessToken}`)
    .attach('files', Buffer.from('image'), {
      filename: 'image.png',
      contentType: 'image/png',
    })
    .expect(200);

  const created = await request(helper.getHttpServer())
    .post('/api/documents')
    .set('Authorization', `Bearer ${accessToken}`)
    .send({
      title: '附件闭环',
      content: '测试正文',
      attachmentIds: [upload.body[0].id],
    })
    .expect(200);

  expect(created.body.attachments).toHaveLength(1);
  expect(created.body.attachments[0]).toMatchObject({
    id: upload.body[0].id,
    bizType: 'document',
    bizId: created.body.id,
  });
});

it('lets the document owner get a private attachment signed url', async () => {
  const response = await request(helper.getHttpServer())
    .get(`/api/documents/${documentId}/attachments/${attachmentId}/signed-url`)
    .set('Authorization', `Bearer ${accessToken}`)
    .expect(200);

  expect(response.body.url).toContain('/api/attachments/content/');
  expect(response.body.expiresAt).toEqual(expect.any(Number));
});

it('rejects another ordinary user with 403', async () => {
  await request(helper.getHttpServer())
    .get(`/api/documents/${documentId}`)
    .set('Authorization', `Bearer ${otherAccessToken}`)
    .expect(403);
});

it('soft deletes the document and its attachment metadata', async () => {
  await request(helper.getHttpServer())
    .delete(`/api/documents/${documentId}`)
    .set('Authorization', `Bearer ${accessToken}`)
    .expect(200);

  const attachment = await helper.dataSource
    .getRepository(Attachment)
    .findOne({
      where: { id: attachmentId },
      withDeleted: true,
    });

  expect(attachment?.deletedAt).toBeInstanceOf(Date);
});
```

另外覆盖：

- 更新时新增、保留、移除附件。
- 传入其他业务已绑定附件返回 409。
- 通用 `DELETE /api/attachments/:id` 对文档附件返回 409。
- 管理员可以读取普通用户文档。
- 父级附件校验失败时文档写入回滚。

测试用户必须显式分配普通用户角色，否则当前 signup 流程不会自动挂载角色：

```ts
const result = await helper.signupAndLogin({
  username: 'document-user',
  email: 'document@example.com',
  password: 'password123',
  roles: [RoleCode.USER],
});
accessToken = result.accessToken;
```

- [ ] **Step 2: 运行后端测试**

Run:

```bash
yarn workspace @my-first-nest/server test tests/unit/modules/attachments/attachments.service.spec.ts
yarn workspace @my-first-nest/server test tests/unit/modules/documents/documents.service.spec.ts
yarn workspace @my-first-nest/server test:e2e tests/e2e/documents.e2e-spec.ts
yarn workspace @my-first-nest/server type-check
```

Expected: 全部 PASS。e2e 需要 PostgreSQL 和 Redis 已启动，并按项目现有测试库配置运行。

---

### Task 5: 前端文档 API 和附件组件增强

**Files:**

- Create: `apps/web/src/services/types/document.ts`
- Create: `apps/web/src/services/dtos/document.ts`
- Create: `apps/web/src/services/api/document.ts`
- Create: `apps/web/src/services/api/__tests__/document.test.ts`
- Modify: `apps/web/src/components/attachment-upload/index.tsx`
- Modify: `apps/web/src/components/attachment-upload/attachment-preview.tsx`

**Interfaces:**

- Consumes: `newHttp`、`IAttachment`、`IAttachmentSignedUrl`。
- Produces:

```ts
export const DOCUMENT_STATUS = {
  DRAFT: 'draft',
  PUBLISHED: 'published',
} as const;

export type DocumentStatus =
  (typeof DOCUMENT_STATUS)[keyof typeof DOCUMENT_STATUS];

export interface IDocumentListItem {
  id: string;
  title: string;
  status: DocumentStatus;
  owner: { id: string; displayName: string };
  attachmentCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface IDocument {
  id: string;
  title: string;
  content: string;
  status: DocumentStatus;
  owner: { id: string; displayName: string };
  attachments: IAttachment[];
  createdAt: string;
  updatedAt: string;
}

export interface IDocumentsPage {
  list: IDocumentListItem[];
  total: number;
  page: number;
  pageSize: number;
}
```

API 函数：

```ts
export const CreateDocument = async (data: ICreateDocumentDto) => {
  const response = await http.post<IDocument>('/documents', data);
  return response.data;
};

export const GetDocuments = async (params?: IFindDocumentsQuery) => {
  const response = await http.get<IDocumentsPage>('/documents', { params });
  return response.data;
};

export const GetDocument = async (id: string) => {
  const response = await http.get<IDocument>(`/documents/${id}`);
  return response.data;
};

export const UpdateDocument = async (
  id: string,
  data: IUpdateDocumentDto,
) => {
  const response = await http.patch<IDocument>(`/documents/${id}`, data);
  return response.data;
};

export const DeleteDocument = async (id: string) => {
  const response = await http.delete(`/documents/${id}`);
  return response.data;
};

export const GetDocumentAttachmentSignedUrl = async (
  documentId: string,
  attachmentId: string,
) => {
  const response = await http.get<IAttachmentSignedUrl>(
    `/documents/${documentId}/attachments/${attachmentId}/signed-url`,
  );
  return response.data;
};
```

`AttachmentPreview` 新增可选 prop：

```ts
interface IAttachmentPreviewProps {
  attachment: IAttachment;
  getSignedUrl?: (attachmentId: string) => Promise<IAttachmentSignedUrl>;
}
```

私有图片加载改为：

```ts
const requestSignedUrl =
  getSignedUrl ??
  ((attachmentId: string) => GetAttachmentSignedUrl(attachmentId));

requestSignedUrl(attachment.id)
  .then(({ url }) => {
    if (!cancelled) setPreviewUrl(url);
  })
  .catch(() => {
    if (!cancelled) setPreviewUrl('');
  })
  .finally(() => {
    if (!cancelled) setLoading(false);
  });
```

`AttachmentUpload` 给 `AttachmentPreview` 透传 `getSignedUrl`，并处理删除失败：

```ts
const handleDelete = async (attachment: IAttachment) => {
  try {
    await DeleteAttachment(attachment.id);
  } catch (error) {
    message.error(
      error instanceof Error ? error.message : '附件删除失败，请稍后重试',
    );
    return;
  }

  const nextValue = valueRef.current.filter(
    (item) => item.id !== attachment.id,
  );
  valueRef.current = nextValue;
  onChange?.(nextValue);
};
```

- [ ] **Step 1: 编写文档 API 测试**

`document.test.ts` mock `new-http`，断言：

- 创建使用 `POST /documents`。
- 更新使用 `PATCH /documents/:id`。
- 删除使用 `DELETE /documents/:id`。
- 文档附件签名使用 `/documents/:documentId/attachments/:attachmentId/signed-url`。

- [ ] **Step 2: 实现类型、DTO、API 和附件组件增强**

按签名创建文件。所有请求复用 `newHttp`，不创建新的 Axios 实例。

- [ ] **Step 3: 运行前端验证**

Run:

```bash
yarn workspace @my-first-nest/web test src/services/api/__tests__/document.test.ts
yarn workspace @my-first-nest/web type-check
```

Expected: PASS。

---

### Task 6: 文档列表、表单、详情和路由

**Files:**

- Create: `apps/web/src/pages/documents/index.tsx`
- Create: `apps/web/src/pages/documents/components/document-form.tsx`
- Create: `apps/web/src/pages/documents/components/document-detail.tsx`
- Create: `apps/web/src/pages/documents/components/document-attachments.tsx`
- Modify: `apps/web/src/router/routes.tsx`
- Modify: `apps/web/src/components/app-sidebar/index.tsx`

**Interfaces:**

- Consumes: Task 5 API、`AttachmentUpload`、`DataTable`。
- Produces: `/documents` 可用的列表、创建、编辑、详情和删除流程。

`DocumentForm` props：

```ts
interface IDocumentFormProps {
  mode: 'create' | 'edit';
  document?: IDocument;
  loading?: boolean;
  onSubmit: (data: ICreateDocumentDto | IUpdateDocumentDto) => void;
  onCancel: () => void;
}
```

表单字段：

- `title`：必填，最大 200。
- `content`：必填，多行文本。
- `status`：`draft` / `published`。
- `attachmentIds`：来自 `AttachmentUpload` 当前值。

编辑模式附件初始值：

```ts
const form = useForm<IDocumentFormValues>({
  defaultValues: {
    title: document?.title ?? '',
    content: document?.content ?? '',
    status: document?.status ?? DOCUMENT_STATUS.DRAFT,
    attachments: document?.attachments ?? [],
  },
});
```

提交时只发送完整 ID 数组：

```ts
const values = form.getValues();
onSubmit({
  title: values.title,
  content: values.content,
  status: values.status,
  attachmentIds: values.attachments.map((attachment) => attachment.id),
});
```

`AttachmentUpload` 在编辑模式使用文档签名回调：

```tsx
<Controller
  name="attachments"
  control={control}
  render={({ field }) => (
    <AttachmentUpload
      value={field.value}
      onChange={field.onChange}
      getSignedUrl={
        document
          ? (attachmentId) =>
              GetDocumentAttachmentSignedUrl(document.id, attachmentId)
          : undefined
      }
    />
  )}
/>
```

`DocumentAttachments` 对每张私有图片调用：

```ts
GetDocumentAttachmentSignedUrl(documentId, attachment.id)
```

列表页使用 `DataTable`，列为：

- 标题。
- 状态标签。
- 所有者。
- 附件数量。
- 更新时间。
- 操作：查看、编辑、删除。

删除确认：

```tsx
<Popconfirm
  title="确认删除资料文档"
  description="文档及其附件会进入软删除状态，确定继续吗？"
  okText="确认"
  cancelText="取消"
  onConfirm={() => deleteMutation.mutate(record.id)}
>
  <Button type="text" danger icon={<DeleteOutlined />} />
</Popconfirm>
```

路由加入：

```tsx
{
  path: 'documents',
  element: <Documents />,
}
```

侧边栏在“For U”分组加入：

```tsx
{
  name: '资料文档',
  icon: <FileTextOutlined />,
  path: '/documents',
}
```

- [ ] **Step 1: 实现表单和附件交互**

表单保存失败时不得清空表单或附件状态。`onSubmit` 使用 mutation；只在 `onSuccess` 中关闭弹窗并刷新查询。

- [ ] **Step 2: 实现列表和详情**

列表使用受控服务端分页；详情使用 Drawer，展示 owner、状态、附件大小和附件预览。

- [ ] **Step 3: 注册路由和导航**

修改 `routes.tsx` 与 `app-sidebar/index.tsx`，保持现有命名导出和 React Router 写法。

- [ ] **Step 4: 验证前端构建**

Run:

```bash
yarn workspace @my-first-nest/web type-check
yarn workspace @my-first-nest/web build
```

Expected: PASS。

---

### Task 7: 学习文档和最终验证

**Files:**

- Create: `apps/server/src/modules/documents/README.md`
- Create: `apps/docs/src/notes/documents.md`
- Modify: `apps/docs/.vitepress/sidebars/notes.ts`
- Modify: `apps/server/src/modules/attachments/README.md`
- Modify: `apps/docs/src/notes/attachments.md`

**Interfaces:**

- Consumes: 最终实现和测试结果。
- Produces: 文档闭环说明、附件授权边界说明和学习笔记入口。

文档内容必须只写最终行为：

- 文档权限和 owner / admin 范围。
- 创建、更新、删除的事务边界。
- 附件差集同步规则。
- 私有和公开附件访问规则。
- 通用附件接口对已绑定附件的限制。
- 已知边界：取消保存产生的未绑定附件交给物理清理任务。

- [ ] **Step 1: 写模块 README 和 VitePress 笔记**

README 描述整体流程和关键约束；`documents.md` 使用 include 引入 README：

```md
<!--@include: ../../../../server/src/modules/documents/README.md-->
```

在 `notes.ts` 增加：

```ts
{ text: '资料文档附件', link: '/notes/documents' },
```

同时更新附件笔记，补充“文档附件按业务权限签发”和“已绑定附件禁止通用删除 / 头像绑定”。

- [ ] **Step 2: 运行完整验证**

Run:

```bash
yarn workspace @my-first-nest/server type-check
yarn workspace @my-first-nest/server test
yarn workspace @my-first-nest/server test:e2e
yarn workspace @my-first-nest/web type-check
yarn workspace @my-first-nest/web test
yarn workspace @my-first-nest/web build
git diff --check
```

Expected: 所有命令通过，`git diff --check` 无输出。

- [ ] **Step 3: 手工验收**

按 Spec 第 11.3 节逐项验证：

1. 普通用户创建带私有附件的文档。
2. 重新打开编辑页，附件正确回显和保存。
3. 其他普通用户访问文档和签名接口被拒绝。
4. 管理员可以管理普通用户文档。
5. 文档附件设为公开后可匿名读取。
6. 删除文档后文档和附件元数据进入软删除。
7. 对已绑定文档附件调用通用删除和头像绑定返回 `ATTACHMENT_IN_USE`。

---

## Self-Review

### Spec Coverage

- 文档模块、权限、owner / admin：Task 1、Task 3、Task 4。
- 创建、列表、详情、更新、删除：Task 3、Task 4、Task 6。
- 附件绑定、差集同步、事务：Task 2、Task 3。
- 私有附件文档权限签名：Task 2、Task 3、Task 4、Task 5。
- 公开附件规则：Task 2、Task 4、Task 7。
- 通用附件限制：Task 2、Task 4。
- 前端列表、创建、编辑、详情、删除：Task 5、Task 6。
- 删除失败反馈：Task 5。
- 数据库迁移：Task 1。
- 测试与手工验收：Task 4、Task 5、Task 6、Task 7。

### Type Consistency

- 服务端业务类型统一使用 `ATTACHMENT_BIZ_TYPE.DOCUMENT`。
- 文档状态统一使用 `DocumentStatus` 和 `DOCUMENT_STATUS`。
- 附件集合方法统一命名为 `syncDocumentAttachments`。
- 文档签名方法统一命名为 `createAttachmentSignedUrl`，内部调用 `createSignedUrlForUser`。
- 前端类型统一使用 `IDocument`、`IDocumentListItem`、`IDocumentsPage`。

### Boundary Check

- 物理清理任务不在本计划中实现。
- 本计划不新增对象存储、病毒扫描、文档版本、评论或搜索能力。
- 本计划不删除物理文件。
