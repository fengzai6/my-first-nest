# 附件上传 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现本地存储、可切换到对象存储的附件模块，提供上传、业务模块按授权查询、绑定、公开状态切换、软删除、短时签名访问，并将头像上传接入个人设置和用户管理编辑弹窗。

**Architecture:** `Attachment` 实体保存业务元数据和存储 key，存储接口隔离本地磁盘与未来 OSS 驱动，控制器只处理 HTTP 与权限。公开附件返回稳定 URL，私有附件先通过鉴权接口换取按当前用户签发、5 分钟有效的签名 URL，前端将签名 URL 直接交给 `<img>`。内容读取只校验签名和过期时间，与未来 OSS 签名 URL 的消费方式保持一致。

**Tech Stack:** NestJS 11、TypeORM、PostgreSQL、Multer、class-validator、Swagger、React 19、Ant Design、TanStack Query、Axios。

**Spec:** [2026-09-14-attachment-upload-design.md](../specs/2026-09-14-attachment-upload-design.md)

## Global Constraints

- 响应统一使用简体中文。
- 文件/目录使用 kebab-case，React 组件使用命名导出。
- 后端文件限制：通用附件支持图片、PDF、Office 文档、压缩包；单文件 10 MB；单次最多 5 个。
- 通用附件的 MIME 白名单使用精确字符串，不根据扩展名推断；前后端无法共享实现时，各自维护的清单必须保持一致并由契约测试覆盖。
- 头像仅允许 JPEG、PNG、WebP；单文件 2 MB；不裁剪。
- 头像附件强制公开；普通附件默认私有，上传者或超级管理员可切换公开状态。
- 上传和读取公开文件不需要额外权限；私有签名 URL 仅允许上传者或超级管理员获取。
- 不提供通用附件 HTTP 查询接口；业务模块完成自身权限校验后调用 `AttachmentsService.findByBusiness()`。
- 通用 HTTP 接口不接收或修改业务绑定；业务关联由业务模块鉴权后调用服务层。
- 删除采用软删除；本次不实现磁盘文件清理任务。
- `users.avatar` 继续保存公开访问 URL，不新增用户表字段。
- 不新增 `Attachment` 细粒度权限；沿用登录态和 `super_admin` 特殊角色。
- 本地存储目录由 `UPLOAD_DIR` 配置，默认 `uploads`；`UPLOAD_URL_PREFIX` 默认 `/api/attachments/content`。
- Multer 使用 `<UPLOAD_DIR>/tmp` 临时目录，控制器在成功和失败路径下清理临时文件。
- `UPLOAD_SIGNATURE_SECRET` 必须显式配置，缺失或使用弱默认值时启动失败。
- 前端请求继续复用 `newHttp`，不自行实现 Axios 实例。
- 本次不新增独立附件管理页，不接入用户创建表单。
- 本次不执行 `git add`、`git commit`、`git push` 或任何其他 git 写操作。

---

## File Structure

**后端新增**

- `apps/server/src/modules/attachments/entities/attachment.entity.ts`：附件元数据实体。
- `apps/server/src/modules/attachments/constants/attachment.constants.ts`：业务类型、可见性、限制常量。
- `apps/server/src/modules/attachments/interfaces/attachment-storage.interface.ts`：存储驱动接口。
- `apps/server/src/modules/attachments/interfaces/attachment-view.interface.ts`：服务端附件返回视图。
- `apps/server/src/modules/attachments/services/local-attachment-storage.service.ts`：本地磁盘驱动。
- `apps/server/src/modules/attachments/attachment-signature.service.ts`：签名 URL 的签发和校验。
- `apps/server/src/modules/attachments/dto/upload-attachment.dto.ts`：上传表单 DTO。
- `apps/server/src/modules/attachments/dto/update-attachment.dto.ts`：绑定与可见性 DTO。
- `apps/server/src/modules/attachments/attachments.controller.ts`：上传、更新、删除、签名和内容读取接口。
- `apps/server/src/modules/attachments/attachments.service.ts`：附件业务逻辑。
- `apps/server/src/modules/attachments/attachments.module.ts`：模块组装。
- `apps/server/src/common/exceptions/attachment.exception.ts`：附件错误码。
- `apps/server/database/migrations/20260913120000-create-attachments.ts`：附件表迁移。

**后端修改**

- `apps/server/src/config/configuration.interface.ts`：新增 `upload` 配置类型。
- `apps/server/src/config/config.default.ts`：新增上传配置默认值。
- `apps/server/src/modules/index.ts`：注册 `AttachmentsModule`。
- `apps/server/src/modules/users/users.service.ts`：支持更新头像 URL 并软删除旧头像附件。
- `apps/server/src/modules/users/dto/update-user.dto.ts`：增加仅用于绑定头像附件的入参字段。

**前端新增**

- `apps/web/src/services/types/attachment.ts`：附件类型。
- `apps/web/src/services/dtos/attachment.ts`：附件 DTO。
- `apps/web/src/services/api/attachment.ts`：附件 API。
- `apps/web/src/components/attachment-upload/index.tsx`：通用上传与列表组件。
- `apps/web/src/components/attachment-upload/attachment-preview.tsx`：私有图片签名地址加载与预览。
- `apps/web/src/components/avatar-upload/index.tsx`：头像上传组件。

**前端修改**

- `apps/web/src/pages/settings/components/profile-form.tsx`：接入头像上传。
- `apps/web/src/pages/settings/index.tsx`：头像上传成功后同步用户状态和缓存。
- `apps/web/src/pages/management/users/components/user-form.tsx`：编辑用户时接入头像上传。
- `apps/web/src/pages/management/users/index.tsx`：编辑保存后维护附件绑定和缓存。
- `apps/web/src/services/api/new-http.ts`：为 FormData 请求移除默认 JSON `Content-Type`。

**部署修改**

- `docker/nginx.conf`：将请求体限制从 `50m` 调整为 `64m`。
- `docker/docker-compose.local.yml`、`docker/docker-compose.app.yml`：确认 `UPLOAD_DIR=/app/uploads`，上传卷同时承载临时目录和最终文件。

**后端测试新增**

- `apps/server/src/modules/attachments/attachment-signature.service.spec.ts`
- `apps/server/src/modules/attachments/services/local-attachment-storage.service.spec.ts`
- `apps/server/src/modules/attachments/attachments.service.spec.ts`

**前端测试新增**

- `apps/web/src/services/api/__tests__/attachment.test.ts`

---

### Task 1: 配置与数据库结构

**Files:**

- Create: `apps/server/src/modules/attachments/entities/attachment.entity.ts`
- Create: `apps/server/database/migrations/20260913120000-create-attachments.ts`
- Modify: `apps/server/src/config/configuration.interface.ts`
- Modify: `apps/server/src/config/config.default.ts`
- Modify: `apps/server/package.json`

**Interfaces:**

- Consumes: `BaseEntity` 提供 `id`、时间戳和软删除字段。
- Produces: `Attachment` 实体；`UploadConfig` 配置类型；`upload` 配置段。

实体字段固定为：

```ts
export const ATTACHMENT_VISIBILITY = {
  PRIVATE: 'private',
  PUBLIC: 'public',
} as const;

export type AttachmentVisibility =
  (typeof ATTACHMENT_VISIBILITY)[keyof typeof ATTACHMENT_VISIBILITY];

export class Attachment extends BaseEntity {
  originalName: string;
  storageKey: string;
  mimeType: string;
  size: number;
  visibility: AttachmentVisibility;
  storageProvider: string;
  bizType: string | null;
  bizId: string | null;
  uploadedBy: User;
}
```

- [ ] **Step 1: 新增上传配置类型**

在 `configuration.interface.ts` 中加入：

```ts
export interface UploadConfig {
  /** 本地存储根目录 */
  dir?: string;
  /** 本地文件公开访问前缀 */
  urlPrefix?: string;
  /** 签名 URL 有效期，单位秒 */
  signedUrlExpiresIn?: number;
  /** 签名密钥 */
  secret?: string;
}

export interface AppConfig {
  // ...existing fields
  upload?: UploadConfig;
}
```

- [ ] **Step 2: 添加默认配置**

在 `config.default.ts` 的返回值中加入：

```ts
upload: {
  dir: process.env.UPLOAD_DIR || 'uploads',
  urlPrefix: process.env.UPLOAD_URL_PREFIX || '/api/attachments/content',
  signedUrlExpiresIn: parseNumberEnv(
    process.env.UPLOAD_SIGNED_URL_EXPIRES_IN,
    300,
  ),
  secret: process.env.UPLOAD_SIGNATURE_SECRET,
},
```

启动时校验 `upload.secret` 存在且不是已知弱值；缺失时抛出配置错误，不使用 `JWT_SECRET` 或固定字符串兜底。

安装后端直接使用的上传依赖：

```bash
yarn workspace @my-first-nest/server add multer
yarn workspace @my-first-nest/server add -D @types/multer
```

`npmMinimalAgeGate` 已配置为 1440 分钟，安装命令由 Yarn 自动执行最小发布年龄检查。

- [ ] **Step 3: 新增实体**

创建 `attachment.entity.ts`，使用 `@Entity('attachments')`，关系如下：

```ts
@ManyToOne(() => User, { nullable: false, onDelete: 'RESTRICT' })
@JoinColumn({ name: 'uploaded_by_id' })
uploadedBy: User;
```

`storageKey` 加唯一约束；`bizType`、`bizId`、`visibility`、`uploadedBy` 建组合索引。

- [ ] **Step 4: 新增迁移**

迁移 `up()` 创建附件表、唯一索引和查询索引：

```sql
CREATE TABLE "attachments" (
  "id" bigint NOT NULL,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
  "deleted_at" TIMESTAMP,
  "original_name" character varying(255) NOT NULL,
  "storage_key" character varying(500) NOT NULL,
  "mime_type" character varying(127) NOT NULL,
  "size" integer NOT NULL,
  "visibility" character varying(16) NOT NULL DEFAULT 'private',
  "storage_provider" character varying(32) NOT NULL DEFAULT 'local',
  "biz_type" character varying(64),
  "biz_id" bigint,
  "uploaded_by_id" bigint NOT NULL,
  CONSTRAINT "PK_attachments_id" PRIMARY KEY ("id")
);
```

同时创建 `storage_key` 唯一索引、`biz_type + biz_id + deleted_at` 索引、`uploaded_by_id + visibility + deleted_at` 索引和外键。

- [ ] **Step 5: 验证**

Run:

```bash
yarn workspace @my-first-nest/server type-check
```

Expected: PASS。

---

### Task 2: 本地存储驱动

**Files:**

- Create: `apps/server/src/modules/attachments/interfaces/attachment-storage.interface.ts`
- Create: `apps/server/src/modules/attachments/services/local-attachment-storage.service.ts`
- Create: `apps/server/src/modules/attachments/services/local-attachment-storage.service.spec.ts`

**Interfaces:**

- Produces: `IAttachmentStorage`；`LocalAttachmentStorageService`

```ts
export interface IStoredFile {
  key: string;
}

export interface IReadableStoredFile {
  stream: NodeJS.ReadableStream;
  mimeType?: string;
}

export interface IAttachmentStorage {
  save(file: Express.Multer.File): Promise<IStoredFile>;
  read(key: string): Promise<IReadableStoredFile>;
  remove(key: string): Promise<void>;
}
```

- [ ] **Step 1: 写失败测试**

测试本地驱动必须：

1. 保存文件后生成不带用户文件名的 key。
2. `read()` 返回可读流。
3. `remove()` 后再次 `read()` 抛出错误。
4. 拒绝包含 `..` 的 key。

Run:

```bash
yarn workspace @my-first-nest/server test src/modules/attachments/services/local-attachment-storage.service.spec.ts
```

Expected: FAIL，提示模块不存在。

- [ ] **Step 2: 实现接口与本地驱动**

存储 key 格式：

```text
YYYY/MM/<snowflake-id>.<safe-extension>
```

`LocalAttachmentStorageService` 负责：

- 用 `mkdir` 创建目录。
- 用 `rename` 将 Multer 临时文件迁移到最终路径，跨设备失败时回退为复制后删除源文件。
- 用 `createReadStream` 读取。
- 用 `unlink` 删除。
- 对解析后的路径做根目录包含检查，拒绝路径穿越。

- [ ] **Step 3: 重新运行测试**

Run:

```bash
yarn workspace @my-first-nest/server test src/modules/attachments/services/local-attachment-storage.service.spec.ts
```

Expected: PASS。

---

### Task 3: 签名服务

**Files:**

- Create: `apps/server/src/modules/attachments/attachment-signature.service.ts`
- Create: `apps/server/src/modules/attachments/attachment-signature.service.spec.ts`

**Interfaces:**

- Produces:

```ts
interface ISignaturePayload {
  attachmentId: string;
  userId: string;
  expiresAt: number;
}

class AttachmentSignatureService {
  createSignedUrl(attachmentId: string, userId: string): string;
  verifySignature(
    attachmentId: string,
    userId: string,
    expiresAt: number,
    signature: string,
  ): boolean;
}
```

- [ ] **Step 1: 写失败测试**

测试必须覆盖：

1. 同一输入生成的签名可验证。
2. 附件 ID 改变后验证失败。
3. 用户 ID 改变后验证失败。
4. 过期时间改变后验证失败。
5. 超过 `expiresAt` 后验证失败。

Run:

```bash
yarn workspace @my-first-nest/server test src/modules/attachments/attachment-signature.service.spec.ts
```

Expected: FAIL，提示 service 不存在。

- [ ] **Step 2: 实现 HMAC 签名**

签名载荷固定为：

```text
<attachmentId>.<userId>.<expiresAt>
```

使用 Node `crypto.createHmac('sha256', secret)`，输出 base64url。URL 固定为：

```text
/api/attachments/content/<id>?expiresAt=<timestamp>&userId=<userId>&signature=<signature>
```

用 `timingSafeEqual` 比较签名。

- [ ] **Step 3: 重新运行测试**

Run:

```bash
yarn workspace @my-first-nest/server test src/modules/attachments/attachment-signature.service.spec.ts
```

Expected: PASS。

---

### Task 4: 附件服务与控制器

**Files:**

- Create: `apps/server/src/modules/attachments/constants/attachment.constants.ts`
- Create: `apps/server/src/modules/attachments/dto/upload-attachment.dto.ts`
- Create: `apps/server/src/modules/attachments/dto/update-attachment.dto.ts`
- Create: `apps/server/src/modules/attachments/attachments.service.ts`
- Create: `apps/server/src/modules/attachments/attachments.service.spec.ts`
- Create: `apps/server/src/modules/attachments/attachments.controller.ts`
- Create: `apps/server/src/modules/attachments/attachments.module.ts`
- Create: `apps/server/src/common/exceptions/attachment.exception.ts`
- Modify: `apps/server/src/modules/index.ts`

**Interfaces:**

- Consumes: `IAttachmentStorage`、`AttachmentSignatureService`、`Attachment`
- Produces: 以下 HTTP 契约：

```text
POST   /api/attachments
PATCH  /api/attachments/:id
GET    /api/attachments/:id/signed-url
GET    /api/attachments/content/:id
DELETE /api/attachments/:id
```

- Produces: `findByBusiness(bizType: string, bizId: string): Promise<IAttachmentView[]>`，仅供业务模块在完成权限校验后调用。

- [ ] **Step 1: 写失败测试**

`attachments.service.spec.ts` 必须覆盖：

1. 公开附件直接返回公开 URL。
2. 私有附件由上传者获取签名 URL。
3. 非上传者获取私有附件签名 URL 时抛出禁止访问。
4. 超级管理员可以获取私有附件签名 URL。
5. 删除时只软删除元数据，不物理删除存储文件。
6. 一般用户不能删除他人附件或修改为公开。
7. 多文件保存失败时清理本次已迁移的全部最终文件。
8. 已绑定头像的附件不能通过通用更新或删除接口操作。

Run:

```bash
yarn workspace @my-first-nest/server test src/modules/attachments/attachments.service.spec.ts
```

Expected: FAIL，提示模块不存在。

- [ ] **Step 2: 实现错误码**

在 `attachment.exception.ts` 中定义：

```ts
export const AttachmentExceptionCode = {
  FILE_REQUIRED: 'ATTACHMENT_FILE_REQUIRED',
  FILE_TOO_LARGE: 'ATTACHMENT_FILE_TOO_LARGE',
  MIME_TYPE_NOT_ALLOWED: 'ATTACHMENT_MIME_TYPE_NOT_ALLOWED',
  NOT_FOUND: 'ATTACHMENT_NOT_FOUND',
  FORBIDDEN: 'ATTACHMENT_FORBIDDEN',
  INVALID_SIGNATURE: 'ATTACHMENT_INVALID_SIGNATURE',
  IN_USE: 'ATTACHMENT_IN_USE',
} as const;
```

按现有 `BaseException` 风格实现 `AttachmentException`。

- [ ] **Step 3: 实现 DTO**

`UploadAttachmentDto` 字段：

```ts
visibility?: 'private' | 'public';
```

`UpdateAttachmentDto` 字段：

```ts
visibility?: 'private' | 'public';
```

业务绑定不通过 HTTP DTO 修改，由业务模块调用服务层。查询同样不提供 HTTP DTO。

- [ ] **Step 4: 实现 Service**

上传流程：

1. 校验文件存在。
2. 逐个校验 MIME 类型和大小。
3. 调用存储驱动将临时文件迁移到最终位置。
4. 创建附件实体并批量保存。
5. 迁移或数据库保存失败时删除本次已迁移的全部最终文件，随后继续抛出原始错误。
6. 无论成功或失败，控制器清理临时文件。
7. 返回附件视图数组，每项包含 `url`。

私有内容读取流程：

1. 校验签名。
2. 校验附件存在且未删除。
3. 从存储驱动返回流。

内容读取不依赖登录态，也不再次校验上传者或超级管理员。

公开内容读取流程：

1. 附件存在且未删除。
2. `visibility === 'public'`。
3. 从存储驱动返回流。

- [ ] **Step 5: 实现 Controller**

上传接口使用：

```ts
@UseInterceptors(
  FilesInterceptor('files', 5, {
    storage: diskStorage({
      destination: uploadTempDir,
      filename: (_request, _file, callback) => callback(null, randomUUID()),
    }),
    limits: { fileSize: MAX_ATTACHMENT_SIZE },
  }),
)
```

Controller 使用 `@UploadedFiles()` 接收文件数组，POST 请求成功返回 `IAttachmentView[]`，并在 `finally` 中删除本次请求的所有临时文件。

内容读取接口需要同时支持公开请求和签名请求：

- 内容接口必须使用 `@Public()` 跳过全局 JWT 守卫。
- 公开附件不校验查询参数。
- 私有附件由 Service 使用 `expiresAt`、`userId`、`signature` 查询参数校验 HMAC 和过期时间，不读取当前登录用户。
- 路由参数和签名查询参数均做类型转换和长度限制。

文件响应手动设置：

```ts
res.setHeader('Content-Type', attachment.mimeType);
res.setHeader(
  'Content-Disposition',
  `inline; filename*=UTF-8''${encodeURIComponent(attachment.originalName)}`,
);
```

- [ ] **Step 6: 注册模块与静态排除**

在 `modules/index.ts` 加入 `AttachmentsModule`。现有 `StaticModule` 已排除 `/api/{*path}`，无需修改，也不新增上传目录的静态暴露。

- [ ] **Step 7: 运行测试**

Run:

```bash
yarn workspace @my-first-nest/server test src/modules/attachments
yarn workspace @my-first-nest/server type-check
```

Expected: PASS。

---

### Task 5: 用户头像后端链路

**Files:**

- Modify: `apps/server/src/modules/users/users.service.ts`
- Modify: `apps/server/src/modules/attachments/attachments.service.ts`

**Interfaces:**

- Consumes: `AttachmentsService.bindUserAvatar(userId, attachmentId, manager)`
- Produces: 更新用户头像时绑定新附件、软删除旧附件元数据并返回公开 URL。

固定业务约定：

```text
bizType = user-avatar
bizId = userId
头像 visibility 强制 public
```

- [ ] **Step 1: 写失败测试**

在 `attachments.service.spec.ts` 中新增：

1. `bindUserAvatar()` 将附件设为公开并绑定到 `user-avatar`。
2. 同一用户绑定新头像时，旧头像附件仅软删除，不物理删除文件。
3. 普通用户只能绑定到自己的用户 ID。
4. 超级管理员可以绑定到其他用户 ID。
5. 普通用户不能绑定他人上传的附件。
6. 绑定事务失败时用户字段、附件绑定、头像 URL 和旧头像软删除全部回滚。

Run:

```bash
yarn workspace @my-first-nest/server test src/modules/attachments/attachments.service.spec.ts
```

Expected: FAIL，提示 `bindUserAvatar` 不存在。

- [ ] **Step 2: 实现头像绑定**

`AttachmentsService.bindUserAvatar(userId, attachmentId, manager)`：

1. 查询目标附件。
2. 校验操作者权限。
3. 校验附件上传者：普通用户只能绑定自己上传的附件，超级管理员不受限制。
4. 查询同一 `bizType + bizId` 的旧头像。
5. 将新附件更新为公开并绑定。
6. 软删除旧附件元数据，不调用 `storage.remove()`。
7. 返回公开附件 URL。

`bindUserAvatar()` 必须接收当前 TypeORM `EntityManager`，自身不开启独立事务。

- [ ] **Step 3: 用户资料保存头像**

在 `UpdateUserDto` 中增加：

```ts
@ApiPropertyOptional({ description: '新头像附件 ID' })
@IsOptional()
@IsString()
avatarAttachmentId?: string;
```

在 `UsersService.update()` 中识别 `updateUserDto.avatarAttachmentId`：

1. 在同一个事务中执行以下步骤。
2. 从更新 DTO 中取出 `avatarAttachmentId`，避免写入用户实体。
3. 保存其他用户字段。
4. 调用 `attachmentsService.bindUserAvatar(id, avatarAttachmentId, manager)`。
5. 将返回 URL 写入 `user.avatar`。
6. 返回更新后的用户。

未提供 `avatarAttachmentId` 时保持用户现有 `avatar` 不变；更新 DTO 不允许直接覆盖 `avatar`。

`users.avatar` 不允许通过普通更新 DTO 直接覆盖，只能由头像绑定流程写入。

`UsersModule` 导入 `AttachmentsModule`，`AttachmentsModule` 导出 `AttachmentsService`。

- [ ] **Step 4: 运行测试**

Run:

```bash
yarn workspace @my-first-nest/server test src/modules/attachments
yarn workspace @my-first-nest/server type-check
```

Expected: PASS。

---

### Task 6: 前端请求与 API

**Files:**

- Create: `apps/web/src/services/types/attachment.ts`
- Create: `apps/web/src/services/dtos/attachment.ts`
- Create: `apps/web/src/services/api/attachment.ts`
- Create: `apps/web/src/services/api/__tests__/attachment.test.ts`
- Modify: `apps/web/src/services/api/new-http.ts`

**Interfaces:**

- Produces:

```ts
export interface IAttachment {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
  visibility: AttachmentVisibility;
  storageProvider: string;
  bizType: string | null;
  bizId: string | null;
  url: string;
  createdAt: string;
}

export interface IUploadAttachmentDto {
  files: File[];
  visibility?: AttachmentVisibility;
}
```

API 函数：

```ts
UploadAttachment(data: IUploadAttachmentDto): Promise<IAttachment[]>;
UpdateAttachment(id: string, data: IUpdateAttachmentDto): Promise<IAttachment>;
GetAttachmentSignedUrl(id: string): Promise<{ url: string; expiresAt: number }>;
DeleteAttachment(id: string): Promise<void>;
```

- [ ] **Step 1: 写失败测试**

测试 `UploadAttachment()` 必须：

1. 构造 `FormData`，字段名固定为 `files`，支持多个文件。
2. 不手动设置 `Content-Type`。
3. 将 `visibility` 转为字符串追加。
4. 调用 `/attachments`。

Run:

```bash
yarn workspace @my-first-nest/web test src/services/api/__tests__/attachment.test.ts
```

Expected: FAIL，提示 API 模块不存在。

- [ ] **Step 2: 修改请求封装**

在 `new-http.ts` 中，仅当请求数据不是 `FormData` 时设置 JSON `Content-Type`。不要移除 axios 默认处理。

- [ ] **Step 3: 实现类型、DTO 和 API**

所有导出均使用命名导出。API 路径不带 `/api` 前缀，因为 `newHttp` 已配置 `baseURL: "/api"`。

- [ ] **Step 4: 运行测试**

Run:

```bash
yarn workspace @my-first-nest/web test src/services/api/__tests__/attachment.test.ts
```

Expected: PASS。

---

### Task 7: 通用附件上传组件

**Files:**

- Create: `apps/web/src/components/attachment-upload/index.tsx`
- Create: `apps/web/src/components/attachment-upload/attachment-preview.tsx`

**Interfaces:**

```ts
interface IAttachmentUploadProps {
  value?: IAttachment[];
  maxCount?: number;
  accept?: string;
  maxSize?: number;
  visibility?: AttachmentVisibility;
  disabled?: boolean;
  onChange?: (attachments: IAttachment[]) => void;
}
```

- [ ] **Step 1: 实现上传交互**

使用 Ant Design `Upload` 的 `customRequest` 调用 `UploadAttachment()`，关闭内置上传请求。上传前检查 MIME、文件大小和数量，失败时使用 `message.error()`。

- [ ] **Step 2: 实现列表与删除**

已上传附件以列表展示，包含文件图标、文件名、大小和删除按钮。删除调用 `DeleteAttachment()`，成功后从 `value` 中移除并通过 `onChange()` 回传。

- [ ] **Step 3: 实现私有图片预览**

`AttachmentPreview`：

1. 公开图片直接使用 `attachment.url`。
2. 私有图片先调用 `GetAttachmentSignedUrl()`。
3. 将返回值交给 `<img>`。
4. 图片 `src` 只在组件本地状态中保存，不写入 Zustand 或 React Query 持久缓存；签名 URL 过期后重新获取。
5. 加载失败显示占位图。

- [ ] **Step 4: 验证**

Run:

```bash
yarn workspace @my-first-nest/web type-check
yarn workspace @my-first-nest/web lint
```

Expected: PASS。

---

### Task 8: 头像上传组件与页面接入

**Files:**

- Create: `apps/web/src/components/avatar-upload/index.tsx`
- Modify: `apps/web/src/pages/settings/components/profile-form.tsx`
- Modify: `apps/web/src/pages/settings/index.tsx`
- Modify: `apps/web/src/pages/management/users/components/user-form.tsx`
- Modify: `apps/web/src/pages/management/users/index.tsx`

**Interfaces:**

```ts
interface IAvatarUploadProps {
  value?: { avatarUrl?: string; attachmentId?: string };
  userId?: string;
  disabled?: boolean;
  onChange?: (value: { avatarUrl?: string; attachmentId?: string }) => void;
}
```

- [ ] **Step 1: 实现头像组件**

使用 Ant Design `Upload` 和 `Avatar`，只允许 JPEG、PNG、WebP，单文件 2 MB。上传成功后只调用 `UploadAttachment({ visibility: 'public' })`，并通过 `onChange()` 返回 `{ avatarUrl, attachmentId }`；组件不绑定用户头像。

- [ ] **Step 2: 接入个人设置**

`ProfileForm` 增加头像字段，上传成功后保存 `{ avatarUrl, attachmentId }` 到表单状态；提交时把 `avatarAttachmentId` 写入 `IUpdateUserDto`，由后端绑定并返回最终 `avatar` URL。更新成功后，`Settings` 通过现有 `setUser()` 更新 Zustand，并 invalidate `profile` 查询。

- [ ] **Step 3: 接入用户管理编辑弹窗**

`UserForm` 编辑模式展示头像上传；创建模式不展示。编辑保存时把 `avatarAttachmentId` 传给 `UpdateUser()`，成功后 invalidate `users` 查询。

- [ ] **Step 4: 验证**

Run:

```bash
yarn workspace @my-first-nest/web type-check
yarn workspace @my-first-nest/web lint
yarn workspace @my-first-nest/web build
```

Expected: PASS。

---

### Task 9: 部署、文档与端到端验证

**Files:**

- Create: `apps/server/src/modules/attachments/README.md`
- Create: `apps/docs/src/notes/attachments.md`
- Modify: `apps/docs/.vitepress/sidebars/notes.ts`
- Modify: `docker/nginx.conf`
- Modify: `docker/docker-compose.local.yml`
- Modify: `docker/docker-compose.app.yml`

**Interfaces:**

- Consumes: 已实现附件模块和前端组件。
- Produces: 模块设计说明、部署配置和验证记录。

- [ ] **Step 1: 编写模块文档**

文档只写最终行为、约束、决策和结果：

1. 本地存储与未来 OSS 切换点。
2. 公开附件和私有签名 URL 的权限模型。
3. 头像强制公开并与用户 URL 字段同步。
4. 软删除与磁盘清理边界。
5. API 契约和上传限制。
6. 业务模块查询附件时的权限边界。

- [ ] **Step 2: 配置部署与登记 VitePress**

1. 将 `docker/nginx.conf` 的 `client_max_body_size` 调整为 `64m`。
2. 确认两份 Compose 中 `UPLOAD_DIR=/app/uploads`，上传卷同时承载临时目录和最终文件。
3. 在 `apps/docs/src/notes/attachments.md` 使用 `<!--@include: ...-->` 引入模块 README，并在 `notes.ts` 登记入口。

- [ ] **Step 3: 运行全量检查**

Run:

```bash
yarn workspace @my-first-nest/server test
yarn workspace @my-first-nest/web test
yarn workspace @my-first-nest/server type-check
yarn workspace @my-first-nest/web type-check
yarn workspace @my-first-nest/server lint
yarn workspace @my-first-nest/web lint
yarn workspace @my-first-nest/server build
yarn workspace @my-first-nest/web build
```

Expected: PASS。

- [ ] **Step 4: 手工验证**

1. 启动数据库和服务端、前端。
2. 登录普通用户，上传公开图片并确认无需授权即可访问。
3. 上传私有图片，确认未签名访问失败。
4. 调用签名 URL 接口，确认图片可通过返回 URL 直接展示。
5. 确认其他普通用户无法获取签名 URL。
6. 在个人设置上传头像，确认侧边栏与用户列表头像更新。
7. 在用户管理编辑弹窗替换头像，确认旧头像软删除。
8. 上传超过大小限制的文件，确认前后端均拒绝。
9. 模拟多文件上传的数据库保存失败，确认最终目录不残留本次文件且临时目录被清空。
10. 重启服务端容器，确认公开附件和私有签名附件仍可访问。
11. 普通用户尝试获取他人私有附件签名 URL 或绑定他人上传的附件，确认均被拒绝。
12. 对已绑定头像调用通用更新和删除接口，确认均返回 `ATTACHMENT_IN_USE`。

---

## Self-Review

**Spec coverage:** 已覆盖独立模块、前端组件、本地存储抽象、文件限制、鉴权删除、公开与私有、可见性切换、服务层业务绑定、业务模块查询授权、头像接入、组件契约、头像入口、头像公开、URL 字段映射、头像限制，以及短时签名 URL 方案。

**Placeholder scan:** 未使用 TBD、TODO 或未定义接口占位。

**Type consistency:** 统一使用 `AttachmentVisibility`、`IAttachmentStorage`、`AttachmentSignatureService`、`IAttachment`、`UploadAttachment()`、`findByBusiness()`、`bindUserAvatar()` 和 `bizType = user-avatar`。
- 通用 HTTP 接口仅允许更新未绑定附件的 `visibility`。
