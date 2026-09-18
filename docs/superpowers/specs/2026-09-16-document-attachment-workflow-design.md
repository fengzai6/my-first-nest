# 资料文档附件业务闭环设计

**日期：** 2026-09-16
**状态：** 设计已确认，待实现
**前置：** [2026-09-14-attachment-upload-design.md](./2026-09-14-attachment-upload-design.md)

---

## 1. 设计目标

在现有通用附件模块之上增加一个真实业务消费方，验证附件模块的完整边界：

- 业务模块完成自身权限校验后绑定和查询附件。
- 附件由上传时的未绑定状态，在保存业务对象时进入业务绑定状态。
- 私有附件通过业务权限签发短时 URL。
- 删除业务对象时，在同一事务内处理业务对象与附件元数据。
- 前端提供完整列表、创建、编辑、详情和删除流程。

本设计解决的是“附件能力是否真正可被业务复用”，不是单独提供一个附件管理后台。

## 2. 范围

### 2.1 本次覆盖

- 新增 `documents` 资料文档业务模块。
- 文档创建、列表、详情、更新和软删除。
- 文档附件绑定、替换和移除。
- 文档权限与附件签名授权。
- 前端文档管理页和附件上传交互。
- 通用附件组件删除失败反馈。

### 2.2 本次不覆盖

- 文档协作、版本历史、评论和全文搜索。
- 独立附件管理后台。
- 附件物理文件清理任务。
- 对象存储驱动。
- 病毒扫描、文件魔数校验和内容识别。
- 文档公开范围、分享链接和访客访问。

## 3. 核心决策

| 决策 | 结论 |
| --- | --- |
| 业务对象 | 新增独立 `documents` 模块，不扩展猫咪模块 |
| 权限模型 | 普通用户管理自己的文档；管理员和超级管理员管理全部文档 |
| 创建权限 | 拥有 `document:create` 权限的用户均可创建，创建者自动成为 owner |
| 列表范围 | 普通用户只看自己的文档；管理员和超级管理员看全部文档 |
| 附件上传 | 继续使用通用附件上传接口，上传后先处于未绑定状态 |
| 附件提交 | 创建和更新文档时提交完整 `attachmentIds` |
| 附件同步 | 服务端对附件集合做差集同步，新增集合项绑定，移除项软删除 |
| 事务边界 | 文档保存、附件绑定和被移除附件的软删除在同一数据库事务内 |
| 附件可见性 | 默认私有；上传者可在上传或通用更新时显式设为公开 |
| 私有附件授权 | 文档附件以文档权限为准，不沿用通用附件的上传者权限 |
| 文档删除 | 同一事务内软删除文档及其绑定附件，不删除物理文件 |
| 通用附件限制 | 已绑定文档的附件禁止通过通用附件删除或头像绑定接口操作；通用更新仅允许修改 `visibility` |

## 4. 模块架构

### 4.1 服务端结构

```text
apps/server/src/modules/documents/
├── documents.module.ts
├── documents.controller.ts
├── documents.service.ts
├── constants/
│   └── document.constants.ts
├── dto/
│   ├── create-document.dto.ts
│   ├── update-document.dto.ts
│   ├── find-documents.dto.ts
│   └── signed-attachment-url.dto.ts
├── entities/
│   └── document.entity.ts
└── README.md
```

### 4.2 前端结构

```text
apps/web/src/pages/documents/
├── index.tsx
├── components/
│   ├── document-form.tsx
│   ├── document-detail.tsx
│   └── document-attachments.tsx
```

页面复用 `AttachmentUpload`，不新增第二套附件上传实现。

### 4.3 职责划分

| 组件 | 职责 |
| --- | --- |
| `DocumentsController` | 文档 HTTP 路由、权限装饰器和参数校验 |
| `DocumentsService` | 文档 CRUD、owner 权限、附件差集同步和事务控制 |
| `Document` | 文档标题、内容、状态、owner 和时间戳 |
| `AttachmentsService` | 附件校验、绑定、业务查询、签名和软删除 |
| `Documents` 页面 | 列表、创建、编辑、详情和删除交互 |
| `AttachmentUpload` | 附件上传、删除和预览 |

## 5. 数据模型

### 5.1 表 `documents`

继承项目 `BaseEntity`。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | bigint PK | 文档 ID |
| `title` | varchar(200) | 标题 |
| `content` | text | 正文内容 |
| `status` | varchar(16) | `draft` 或 `published` |
| `owner` | many-to-one User | 文档所有者 |
| `created_at` | timestamp | 创建时间 |
| `updated_at` | timestamp | 更新时间 |
| `deleted_at` | timestamp | 软删除时间 |

索引：

- `(owner_id, deleted_at, created_at DESC)` 用于普通用户列表。
- `(status, deleted_at, created_at DESC)` 用于状态筛选。

### 5.2 附件绑定

文档附件继续使用 `attachments` 表中的以下字段：

- `bizType = document`
- `bizId = document.id`

不新增文档附件关联表。一个附件同一时间只能绑定一个业务对象。

### 5.3 文档状态

```ts
export const DOCUMENT_STATUS = {
  DRAFT: 'draft',
  PUBLISHED: 'published',
} as const;
```

状态只影响业务展示，不影响附件读取权限。

## 6. 权限模型

新增权限：

| 权限码 | 说明 |
| --- | --- |
| `document:create` | 创建文档 |
| `document:read` | 查看自己的文档 |
| `document:update` | 更新自己的文档 |
| `document:delete` | 删除自己的文档 |

角色分配：

- `admin` 默认拥有全部文档权限。
- `user` 默认拥有全部文档权限。
- 超级管理员绕过 RBAC 和 owner 校验。

权限规则：

| 操作 | 普通用户 | 管理员 | 超级管理员 |
| --- | --- | --- | --- |
| 创建 | 允许 | 允许 | 允许 |
| 列表 | 仅自己的 | 全部 | 全部 |
| 详情 | 仅自己的 | 全部 | 全部 |
| 更新 | 仅自己的 | 全部 | 全部 |
| 删除 | 仅自己的 | 全部 | 全部 |
| 获取私有附件签名 URL | 仅自己的文档 | 全部文档 | 全部文档 |

管理员是否属于“全部”由 `RoleCode.ADMIN` 判断。超级管理员继续使用 `SpecialRolesEnum.SuperAdmin`。

## 7. API 设计

### 7.1 文档列表

`GET /api/documents`

查询参数：

- `page`：默认 1。
- `pageSize`：默认 20，最大 100。
- `status`：可选。
- `keyword`：可选，匹配标题。

响应：

```ts
{
  list: IDocumentView[];
  total: number;
  page: number;
  pageSize: number;
}
```

普通用户只能看到自己的文档；管理员和超级管理员可以看到全部文档。

### 7.2 文档详情

`GET /api/documents/:id`

返回文档字段及其当前未删除的附件：

```ts
interface IDocumentView {
  id: string;
  title: string;
  content: string;
  status: DocumentStatus;
  owner: {
    id: string;
    displayName: string;
  };
  attachments: IAttachmentView[];
  createdAt: Date;
  updatedAt: Date;
}
```

附件查询必须在文档权限校验之后调用 `AttachmentsService.findByBusiness('document', id)`。

### 7.3 创建文档

`POST /api/documents`

请求：

```ts
{
  title: string;
  content: string;
  status?: 'draft' | 'published';
  attachmentIds?: string[];
}
```

行为：

1. 创建文档并设置当前用户为 owner。
2. 校验所有附件 ID 存在、未删除且未绑定到其他业务对象。
3. 将附件绑定到 `bizType = document`、`bizId = 文档 ID`。
4. 文档保存和附件绑定在同一事务内。

### 7.4 更新文档

`PATCH /api/documents/:id`

请求：

```ts
{
  title?: string;
  content?: string;
  status?: 'draft' | 'published';
  attachmentIds?: string[];
}
```

附件同步规则：

- 未传 `attachmentIds`：附件不变。
- 传入空数组：软删除当前所有绑定附件。
- 传入非空数组：新增附件绑定，不在此次集合中的旧附件软删除。
- 已绑定的附件可以保留，不重复写入。
- 被移除的附件软删除元数据，不物理删除文件。

所有文档字段更新、附件绑定和附件软删除在同一事务内完成。

### 7.5 删除文档

`DELETE /api/documents/:id`

行为：

1. 校验当前用户拥有删除权限。
2. 在同一事务内软删除文档及其当前绑定附件。
3. 不删除物理文件。
4. 返回成功响应，不返回附件详情。

### 7.6 获取文档附件签名 URL

`GET /api/documents/:documentId/attachments/:attachmentId/signed-url`

行为：

1. 校验文档存在且当前用户有文档读取权限。
2. 校验附件属于该文档且未删除。
3. 签发私有附件短时 URL。
4. 返回：

```json
{
  "url": "/api/attachments/content/<id>?expiresAt=...&userId=...&signature=...",
  "expiresAt": 1780000000000
}
```

该接口不要求当前用户是附件上传人。附件权限以文档权限为准。

## 8. 附件绑定与权限边界

### 8.1 绑定校验

文档服务绑定附件时必须校验：

- 附件存在且未软删除。
- 附件当前 `bizType` 和 `bizId` 为空，或已经绑定到当前文档。
- 附件未绑定到头像或其他业务对象。
- 附件 MIME 和大小符合通用附件限制。

业务附件不复制附件元数据。文档详情通过附件查询视图返回当前可见性、URL 和文件信息。

### 8.2 通用附件接口限制

以下通用操作对已绑定文档的附件返回 `ATTACHMENT_IN_USE`：

- 更新可见性。
- 删除附件。
- 绑定头像。

将文档附件设为公开仍通过通用附件更新接口完成，但只有在附件当前绑定到文档时，且当前用户是上传者或超级管理员，才允许修改可见性。

### 8.3 公开附件

文档附件默认私有。上传者可以在上传时或绑定后通过通用更新接口将附件设为公开。

规则：

- 公开附件可以通过附件 ID 直接读取，不校验文档权限。
- 公开附件分享链接在文档软删除后到物理清理任务执行前仍然有效。
- 将公开附件重新设为私有时，后续访问必须重新获取文档范围内的签名 URL。

## 9. 前端设计

### 9.1 路由与导航

新增路由：

```text
/documents
```

侧边栏新增“资料文档”入口。

### 9.2 文档列表

列表展示：

- 标题
- 状态标签
- 所有者
- 附件数量
- 更新时间
- 操作：查看、编辑、删除

普通用户查询自己的文档；管理员和超级管理员可以查看全部文档。

### 9.3 创建和编辑

表单字段：

- 标题
- 内容
- 状态
- 附件

附件区使用 `AttachmentUpload`：

- 支持上传、预览、删除。
- 编辑已有文档时，初始值为当前附件列表。
- 保存时提交完整 `attachmentIds`。
- 上传成功后附件只存在于未绑定状态，用户取消保存时由孤儿清理任务后续处理。

### 9.4 详情

详情展示：

- 文档字段
- 所有者
- 附件列表和文件大小
- 私有图片预览
- 公开附件直接展示

私有图片的预览 URL 通过文档附件签名接口获取，不调用通用附件签名接口。

### 9.5 删除反馈

`AttachmentUpload` 删除接口失败时必须展示错误提示，并保留当前附件列表，不进行乐观移除。

文档删除使用确认弹窗；成功后刷新列表，失败时保留当前页面并展示错误信息。

## 10. 数据库迁移

新增迁移：

- 创建 `documents` 表。
- 创建文档 owner 外键。
- 创建 owner 和状态查询索引。

不新增附件表字段，不复制附件表数据。

## 11. 测试与验收

### 11.1 服务端

- 普通用户只能查询、更新和删除自己的文档。
- 管理员和超级管理员可以查询、更新和删除任意文档。
- 创建文档时绑定未绑定附件。
- 更新文档时正确执行附件新增、保留和移除。
- 移除附件只软删除元数据，不调用物理删除。
- 文档与附件在同一事务中保存；附件校验失败时文档回滚。
- 已绑定文档的附件不能通过通用更新、删除或头像绑定接口操作。
- 文档附件签名接口按文档权限授权，而不是按附件上传人授权。
- 公开附件可以匿名读取，私有附件必须使用签名 URL。
- 文档软删除时，其绑定附件一并软删除。

### 11.2 前端

- 文档列表、创建、编辑、详情和删除流程可用。
- 编辑时附件初始值正确。
- 保存失败时附件集合和表单状态不丢失。
- 附件删除失败时展示错误提示并保留附件。
- 私有图片使用文档附件签名 URL 预览。
- 公开附件可以直接预览。

### 11.3 手工验收

1. 普通用户创建带私有附件的文档，确认保存后附件绑定成功。
2. 同一用户重新打开编辑页，确认附件回显和保存正常。
3. 普通用户访问其他用户的文档，确认详情和附件签名均被拒绝。
4. 管理员访问普通用户文档，确认可以查看和管理。
5. 将文档附件设为公开，确认无需登录即可读取。
6. 删除文档，确认文档和附件元数据均进入软删除状态。
7. 对已绑定文档的附件调用通用删除和头像绑定接口，确认均返回 `ATTACHMENT_IN_USE`；调用通用更新仅允许修改 `visibility`。

## 12. 后续边界

物理文件清理由独立的附件清理任务设计处理，不在本 Spec 中定义。文档接口不负责清理上传后取消保存产生的未绑定附件。
