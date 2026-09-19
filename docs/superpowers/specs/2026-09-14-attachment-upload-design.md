# 附件上传与访问设计

**日期：** 2026-09-14
**状态：** 设计已确认，待实现核对
**关联计划：** [2026-09-13-attachment-upload.md](../plans/2026-09-13-attachment-upload.md)

---

## 1. 设计目标

提供统一的附件上传、存储、业务绑定与访问能力：

- 附件能力独立于具体业务模块，可被头像及其他业务复用。
- 本地磁盘优先，通过存储接口隔离实现，后续可接入 OSS 等对象存储。
- 公开附件直接访问，私有附件通过短时签名 URL 访问。
- 上传者或超级管理员可以管理附件；业务模块鉴权后可以读取对应业务对象的附件。
- 头像使用公开附件，并继续通过 `users.avatar` 向页面提供稳定 URL。
- 删除附件采用软删除，不立即删除物理文件。

## 2. 范围

### 2.1 本次覆盖

- 通用附件上传、业务模块按授权查询与绑定、更新可见性、软删除。
- 本地文件存储和路径安全校验。
- 私有附件签名 URL 的签发与校验。
- 公开附件内容读取。
- 头像上传、头像附件绑定和旧头像替换。
- 个人设置与用户管理编辑弹窗中的头像上传。
- 通用附件上传组件和私有图片预览。
- Nginx 上传体积、Docker 持久化目录和数据库迁移。

### 2.2 本次不覆盖

- 独立附件管理页面。
- 用户创建表单中的头像上传。
- 附件细粒度权限。
- 对象存储驱动实现。
- 物理文件清理任务。
- 病毒扫描、内容识别和文件魔数校验。
- 图片裁剪、压缩和水印。

## 3. 核心决策

| 决策 | 结论与理由 |
| --- | --- |
| 模块边界 | 使用独立 `attachments` 模块，其他模块只依赖附件服务，不直接操作附件仓储或存储实现 |
| 默认可见性 | 普通附件默认私有；上传者或超级管理员可切换为公开 |
| 业务绑定 | 通用 HTTP 接口不接收 `bizType`、`bizId`；业务模块完成权限校验后调用服务绑定 |
| 私有访问方式 | 使用短时签名 URL，不依赖 Cookie、Blob 或受保护图片接口 |
| 未来存储兼容 | 本地 HMAC 签名 URL 与未来 OSS 签名 URL 保持相同消费方式，前端只保存 URL 并交给 `<img>` |
| 头像关联 | 通过 `bizType = user-avatar`、`bizId = userId` 关联，不新增用户表附件字段 |
| 头像可见性 | 头像附件强制公开，`users.avatar` 保存其公开 URL |
| 删除策略 | 附件元数据软删除，物理文件保留给后续清理任务 |
| 查询策略 | 不提供通用附件 HTTP 查询接口；业务模块完成自身权限校验后，通过 `AttachmentsService.findByBusiness()` 查询 |

## 4. 模块架构

### 4.1 服务端结构

```text
apps/server/src/modules/attachments/
├── attachments.module.ts
├── attachments.controller.ts
├── attachments.service.ts
├── attachment-signature.service.ts
├── constants/
│   └── attachment.constants.ts
├── dto/
│   ├── upload-attachment.dto.ts
│   ├── update-attachment.dto.ts
│   └── content-attachment.dto.ts
├── entities/
│   └── attachment.entity.ts
├── interfaces/
│   ├── attachment-storage.interface.ts
│   └── attachment-view.interface.ts
├── services/
│   └── local-attachment-storage.service.ts
└── README.md
```

### 4.2 职责划分

| 组件 | 职责 |
| --- | --- |
| `AttachmentsController` | HTTP 路由、文件拦截器、响应头处理 |
| `AttachmentsService` | 附件校验、权限、元数据持久化、头像绑定 |
| `AttachmentSignatureService` | 签名 URL 的生成和校验 |
| `IAttachmentStorage` | 文件保存、读取、删除的存储抽象 |
| `LocalAttachmentStorageService` | 本地磁盘实现与路径安全校验 |
| `Attachment` | 附件元数据、可见性、业务关联和上传人 |

### 4.3 访问流程

```text
上传：
客户端 -> POST /api/attachments -> 校验 -> 存储驱动迁移临时文件
       -> Attachment 元数据落库 -> 返回附件视图

公开读取：
GET /api/attachments/content/:id -> 查询公开附件 -> 读取存储 -> 流式返回

私有读取：
GET /api/attachments/:id/signed-url -> 校验上传者或超级管理员
                                    -> 返回短时签名 URL
GET /api/attachments/content/:id?expiresAt=...&userId=...&signature=...
                                    -> 校验签名和过期时间
                                    -> 读取存储 -> 流式返回
```

## 5. 数据模型

### 5.1 表 `attachments`

继承项目 `BaseEntity`，包含雪花 ID、创建时间、更新时间和软删除时间。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | bigint PK | 附件 ID |
| `originalName` | varchar(255) | 用户上传时的原始文件名 |
| `storageKey` | varchar(500), unique | 存储驱动中的文件 key，不返回给客户端 |
| `mimeType` | varchar(127) | 文件 MIME 类型 |
| `size` | integer | 文件大小，单位字节 |
| `visibility` | varchar(16) | `private` 或 `public`，默认 `private` |
| `storageProvider` | varchar(32) | 当前为 `local` |
| `bizType` | varchar(64), nullable | 业务类型 |
| `bizId` | bigint, nullable | 业务记录 ID |
| `uploadedBy` | many-to-one User | 上传人，删除用户时限制删除 |

### 5.2 查询索引

- `storage_key` 唯一索引。
- `(biz_type, biz_id, deleted_at)` 用于业务对象查询。
- `(uploaded_by_id, visibility, deleted_at)` 用于上传人与可见性维度查询。

### 5.3 返回视图

客户端附件视图只包含：

- `id`
- `originalName`
- `mimeType`
- `size`
- `visibility`
- `storageProvider`
- `bizType`
- `bizId`
- `url`
- `createdAt`

`storageKey` 不对外暴露。

## 6. 存储设计

### 6.1 存储接口

```ts
interface IAttachmentStorage {
  save(file: Express.Multer.File): Promise<IStoredFile>;
  read(key: string): Promise<IReadableStoredFile>;
  remove(key: string): Promise<void>;
}
```

Multer 使用临时磁盘存储，`save()` 接收临时文件并将其迁移到最终存储位置。业务服务只依赖该接口；未来接入 OSS 时，应替换存储实现并调整签名服务，不修改附件业务 API。

### 6.2 本地存储

- 根目录由 `UPLOAD_DIR` 配置，默认 `uploads`。
- 临时文件目录为 `<UPLOAD_DIR>/tmp`。
- key 格式为 `YYYY/MM/<snowflake-id>.<extension>`。
- 文件名不保留用户原始文件名，避免冲突和路径注入。
- 扩展名只保留安全字符，不符合规则时省略扩展名。
- 解析后的路径必须位于配置根目录内，拒绝目录穿越。
- 通过统一的上传收尾逻辑清理临时文件，覆盖成功、业务异常和 Multer 校验失败等路径；删除不存在的临时文件时忽略 `ENOENT`。

### 6.3 上传回滚

文件先写入临时目录并迁移到最终存储，再保存元数据。迁移或元数据保存任一失败时，服务会删除本次已迁移的全部最终文件，避免产生无元数据的孤儿文件；清理失败需要记录日志并保留原始错误。

## 7. 权限与访问规则

| 操作 | 鉴权要求 | 权限规则 |
| --- | --- | --- |
| 上传附件 | 登录 | 任意登录用户可上传 |
| 按业务查询 | 由业务模块鉴权 | 业务模块完成业务对象权限校验后调用服务，必须提供 `bizType` 和 `bizId` |
| 读取公开内容 | 无需登录 | 仅允许 `public` 附件 |
| 获取签名 URL | 登录 | 仅上传者或超级管理员 |
| 读取私有内容 | 签名校验 | 签名有效且未过期 |
| 更新附件 | 登录 | 仅上传者或超级管理员 |
| 删除附件 | 登录 | 仅上传者或超级管理员 |
| 绑定头像 | 登录 | 用户本人或超级管理员；普通操作者只能绑定自己上传的附件，超级管理员可绑定任意附件 |

签名 URL 的授权发生在签发阶段。内容读取阶段不要求登录，只校验 HMAC 签名和过期时间；签名中的 `userId` 仅用于标识签发对象，不在内容读取阶段再次比对当前用户。因此上传者和超级管理员获得的签名 URL 使用同一匿名读取流程。

业务附件查询不通过通用 HTTP 接口暴露。具体业务模块必须先校验当前用户是否有权访问目标业务对象，再调用 `AttachmentsService.findByBusiness()`。

## 8. 文件限制

### 8.1 通用附件

- 单文件最大：10 MB。
- 单次最多：5 个。
- 允许 MIME：
  - `image/jpeg`
  - `image/png`
  - `image/webp`
  - `image/gif`
  - `application/pdf`
  - `application/msword`
  - `application/vnd.openxmlformats-officedocument.wordprocessingml.document`
  - `application/vnd.ms-excel`
  - `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
  - `application/vnd.ms-powerpoint`
  - `application/vnd.openxmlformats-officedocument.presentationml.presentation`
  - `application/zip`
  - `application/x-zip-compressed`
  - `application/x-7z-compressed`
  - `application/vnd.rar`
  - `application/x-rar-compressed`

MIME 白名单按上述精确字符串匹配，不根据扩展名推断 MIME。前后端无法共享实现时，各自维护的清单必须保持一致，并由契约测试覆盖。

### 8.2 头像

- 单文件最大：2 MB。
- 允许 MIME：`image/jpeg`、`image/png`、`image/webp`。
- 不裁剪。
- 绑定成功后强制为 `public`。

## 9. API 设计

### 9.1 上传附件

`POST /api/attachments`

- Content-Type：`multipart/form-data`
- 字段：
  - `files`: 文件，必填。
  - `visibility`: 可选，`private` 或 `public`，默认 `private`。
- 返回：`IAttachmentView[]`

### 9.2 按业务查询

不提供通用 HTTP 接口。业务模块先校验业务对象访问权限，再调用：

```ts
AttachmentsService.findByBusiness(bizType: string, bizId: string): Promise<IAttachmentView[]>
```

- 必须同时提供 `bizType` 和 `bizId`。
- 只返回匹配且未软删除的附件元数据，不返回文件内容。
- 私有附件仍需要签名 URL 才能读取内容。

### 9.3 获取签名 URL

`GET /api/attachments/:id/signed-url`

- 需要登录。
- 仅上传者或超级管理员可以获取。
- 返回：

```json
{
  "url": "/api/attachments/content/<id>?expiresAt=...&userId=...&signature=...",
  "expiresAt": 1780000000000
}
```

- 默认有效期：300 秒。

### 9.4 读取附件内容

`GET /api/attachments/content/:id`

- 公开附件无需签名。
- 私有附件必须携带 `expiresAt`、`userId`、`signature`。
- 响应头：
  - `Content-Type`: 附件 MIME。
  - `Content-Disposition`: `inline`，文件名使用 UTF-8 编码。
- 内容以流式方式返回。

### 9.5 更新附件

`PATCH /api/attachments/:id`

- 可更新 `visibility`。
- 仅上传者或超级管理员。
- 通用 HTTP 接口只能更新 `visibility`；业务绑定由业务模块完成权限校验后调用服务层。
- 当前已绑定头像的附件禁止更新，替换头像必须通过保存用户资料触发绑定。
- 返回更新后的附件视图。

### 9.6 删除附件

`DELETE /api/attachments/:id`

- 仅上传者或超级管理员。
- 当前已绑定头像的附件禁止删除；替换头像后旧附件会由头像绑定流程软删除。
- 软删除元数据。
- 当前不删除物理文件。

## 10. 头像集成

### 10.1 绑定流程

1. 前端先通过通用上传接口上传头像附件，可见性固定为 `public`。
2. 用户保存个人资料或管理员编辑用户时，提交 `avatarAttachmentId`。
3. 服务端校验附件 MIME、大小、上传者和操作权限。
4. 服务端设置：
   - `visibility = public`
   - `bizType = user-avatar`
   - `bizId = userId`
5. 服务端将附件公开 URL 写入 `users.avatar`。
6. 服务端软删除该用户之前绑定的其他头像附件。

用户字段更新、附件绑定、`users.avatar` 更新和旧头像软删除必须在同一数据库事务中提交。`users.avatar` 只由头像绑定流程写入，普通用户更新 DTO 不能直接覆盖该字段。

### 10.2 前端接入

- 个人设置支持上传头像。
- 用户管理编辑弹窗支持上传头像。
- 用户创建表单不接入头像上传。
- 头像上传成功后立即预览；正式保存时再绑定到用户。

## 11. 前端组件

### 11.1 通用附件组件

`AttachmentUpload` 提供：

- `value`、`onChange`
- `visibility`
- `maxCount`、`maxSize`
- `accept`
- `disabled`

行为约束：

- 客户端校验文件数量和大小。
- 并发上传时使用待上传计数，避免多选文件越过数量上限。
- 列表展示文件名和格式化大小。
- 上传时不提交业务绑定；业务模块在自身流程中完成绑定。
- 私有图片通过签名 API 获取 URL 后预览。
- 签名获取失败时展示文件占位，不影响其他附件。

### 11.2 头像组件

`AvatarUpload` 提供：

- `value?: { avatarUrl?: string; attachmentId?: string }`
- `disabled`
- `onChange(value: { avatarUrl?: string; attachmentId?: string })`

行为约束：

- 前端先校验 JPEG、PNG、WebP 和 2 MB 限制。
- 上传时固定使用公开附件。
- 不进行裁剪。

### 11.3 HTTP 客户端

上传使用现有 `newHttp`。请求数据为 `FormData` 时自动移除 JSON `Content-Type`，由浏览器生成 multipart boundary。

## 12. 配置

| 配置项 | 环境变量 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `upload.dir` | `UPLOAD_DIR` | `uploads` | 本地存储根目录 |
| `upload.urlPrefix` | `UPLOAD_URL_PREFIX` | `/api/attachments/content` | 内容访问前缀 |
| `upload.signedUrlExpiresIn` | `UPLOAD_SIGNED_URL_EXPIRES_IN` | `300` | 签名有效期，单位秒 |
| `upload.secret` | `UPLOAD_SIGNATURE_SECRET` | 无 | 必填签名密钥，缺失时启动失败 |

签名 URL 的 payload 为：

```text
attachmentId.userId.expiresAt
```

签名算法为 HMAC-SHA256，编码格式为 `base64url`。

## 13. 错误处理

| 错误码 | HTTP 状态 | 说明 |
| --- | --- | --- |
| `ATTACHMENT_FILE_REQUIRED` | 400 | 未选择文件 |
| `ATTACHMENT_FILE_TOO_LARGE` | 413 | 文件超过限制 |
| `ATTACHMENT_MIME_TYPE_NOT_ALLOWED` | 400 | MIME 不在允许列表 |
| `ATTACHMENT_NOT_FOUND` | 404 | 附件或物理文件不存在 |
| `ATTACHMENT_FORBIDDEN` | 403 | 当前用户无权操作附件 |
| `ATTACHMENT_INVALID_SIGNATURE` | 403 | 签名无效或已过期 |
| `ATTACHMENT_IN_USE` | 409 | 已绑定头像的附件不能通过通用更新或删除接口操作 |

## 14. 部署影响

- 数据库新增 `attachments` 表、索引和外键。
- 本地运行和容器运行都必须保证 `UPLOAD_DIR` 持久化。
- Docker Compose 使用独立上传卷。
- 临时目录和最终目录位于同一上传卷，便于原子迁移。
- Nginx 请求体限制设置为 `64m`，为单次 5 个 10 MB 文件及 multipart 开销留出余量。
- 各运行环境必须显式配置 `UPLOAD_SIGNATURE_SECRET`。

## 15. 测试与验收

验收覆盖以下行为：

- 本地存储的保存、读取和路径穿越拒绝。
- 签名创建、校验、篡改拒绝和过期拒绝。
- 上传成功与数据库失败回滚。
- 多文件批量保存失败时清理本次已迁移的全部文件。
- 临时文件在成功和失败路径下均被清理。
- 公开内容无签名读取。
- 私有内容有效签名读取和无效签名拒绝。
- 普通用户、上传者和超级管理员的权限差异。
- 普通用户不能绑定他人上传的附件。
- 头像绑定、强制公开、旧头像软删除，以及已绑定头像禁止通用更新或删除。
- 头像绑定事务失败时，用户字段、附件绑定、头像 URL 和旧附件软删除全部回滚。
- 普通用户更新 DTO 不能直接覆盖 `users.avatar`。
- 通用上传和更新请求中的 `bizType`、`bizId` 不参与绑定。
- 前端附件请求使用 `FormData` 且不覆盖 multipart boundary。
- 重启服务后，已上传文件仍可通过公开或签名 URL 访问。

## 16. 后续扩展

- 增加对象存储驱动，并复用现有签名 URL 消费方式。
- 增加孤儿文件和过期软删除文件的清理任务。
- 增加下载审计、限流和病毒扫描。
- 根据业务需求增加附件管理页面或业务详情页嵌入。
