# 附件管理中心设计

**日期：** 2026-09-18
**状态：** 设计待评审
**前置：**

- [2026-09-14-attachment-upload-design.md](./2026-09-14-attachment-upload-design.md)
- [2026-09-16-document-attachment-workflow-design.md](./2026-09-16-document-attachment-workflow-design.md)
- [2026-09-16-attachment-cleanup-job-design.md](./2026-09-16-attachment-cleanup-job-design.md)

---

## 1. 设计目标

为管理员提供统一的附件审计和管理入口，覆盖正常附件、未绑定孤儿附件和已软删除附件：

- 跨业务查看附件元数据、上传人和绑定关系。
- 复制访问链接、预览、打开和下载附件内容。
- 管理未绑定附件的可见性，软删除未绑定附件。
- 查看附件清理候选状态，触发附件清理任务并查看最近一次清理结果。
- 跳转到附件绑定的业务对象。

本设计补齐的是附件模块的管理能力，不替代文档、头像等业务模块自身的绑定与解绑流程。

## 2. 范围

### 2.1 本次覆盖

- 新增附件管理权限。
- 管理员附件分页查询、详情查询和筛选。
- 正常、孤儿和已软删除附件的统一审计。
- 管理员签名作用域，用于读取任意附件内容。
- 附件链接复制、预览、打开和下载。
- 未绑定附件可见性修改和软删除。
- 批量修改可见性、批量软删除。
- 清理候选状态展示、清理任务触发和最近清理结果展示。
- 管理页路由、侧边栏入口和权限控制。

### 2.2 本次不覆盖

- 管理员上传附件。
- 管理员强制解绑已绑定附件。
- 单个附件立即物理删除。
- 修改文档、头像等业务对象的绑定关系。
- 独立的附件审计表或逐附件清理失败状态表。
- 对象存储驱动和病毒扫描。

## 3. 核心决策

| 决策         | 结论                                                       |
| ------------ | ---------------------------------------------------------- |
| 管理范围     | 新增完整附件管理中心，不做仅只读的分期版本                 |
| 已绑定附件   | 不允许在管理页改可见性、软删除或强制解绑                   |
| 物理删除     | 统一复用 `cleanup-attachments` job，不提供单条立即物理删除 |
| 权限拆分     | 新增 `attachment:read` 和 `attachment:manage`              |
| 软删除与孤儿 | 管理页可查看、筛选和审计                                   |
| 内容访问     | 管理员通过独立 `admin` 签名作用域读取，包括已软删除附件    |
| 数据模型     | 不新增附件表字段和附件表                                   |
| 审计方式     | 复用现有 `LoggerService`，不新增审计表                     |

## 4. 权限模型

新增权限码：

| 权限码              | 说明                                                     |
| ------------------- | -------------------------------------------------------- |
| `attachment:read`   | 查询附件、查看详情、复制链接、预览、打开、下载、跳转业务 |
| `attachment:manage` | 修改可见性、软删除未绑定附件、批量操作、触发清理任务     |

角色分配：

- `admin` 默认拥有 `attachment:read` 和 `attachment:manage`。
- `user` 默认不拥有附件管理权限。
- 超级管理员继续通过 `SpecialRolesEnum.SuperAdmin` 绕过 RBAC。

权限规则：

| 操作                       | `user` | `admin` | 超级管理员 |
| -------------------------- | ------ | ------- | ---------- |
| 查询附件管理列表 / 详情    | 拒绝   | 允许    | 允许       |
| 获取管理员签名 URL         | 拒绝   | 允许    | 允许       |
| 复制链接、预览、打开、下载 | 拒绝   | 允许    | 允许       |
| 修改未绑定附件可见性       | 拒绝   | 允许    | 允许       |
| 软删除未绑定附件           | 拒绝   | 允许    | 允许       |
| 批量修改 / 批量软删除      | 拒绝   | 允许    | 允许       |
| 触发附件清理任务           | 拒绝   | 允许    | 允许       |

前端权限隐藏只用于体验优化，不构成安全边界；后端必须独立执行权限校验。

## 5. 附件状态与清理状态

### 5.1 附件状态

附件状态由现有字段派生：

| 状态      | 条件                                    |
| --------- | --------------------------------------- |
| `bound`   | `bizType` 和 `bizId` 均非空，且未软删除 |
| `orphan`  | `bizType` 和 `bizId` 均为空，且未软删除 |
| `deleted` | `deletedAt` 非空                        |

### 5.2 清理状态

不新增清理状态表。清理状态根据附件清理规则派生：

| 状态            | 条件                                               |
| --------------- | -------------------------------------------------- |
| `not_candidate` | `bound` 附件                                       |
| `waiting`       | 软删除未超过保留期，或孤儿附件创建时间未超过保留期 |
| `eligible`      | 软删除已超过保留期，或孤儿附件创建时间已超过保留期 |

清理失败没有逐附件持久化状态，因此管理页不展示伪造的单条失败状态。失败项继续保持 `eligible`，由后续清理任务重试。

## 6. 内容访问与签名

### 6.1 签名作用域

`AttachmentSignatureService` 的签名载荷增加 `scope`：

| 作用域  | 签发方                             | 读取范围                   |
| ------- | ---------------------------------- | -------------------------- |
| `user`  | 通用附件签名接口、文档附件签名接口 | 未软删除附件               |
| `admin` | 附件管理签名接口                   | 任意附件，包括已软删除附件 |

签名计算必须覆盖 `scope`，防止把普通签名参数篡改为管理员签名。内容接口校验签名时同时校验作用域，管理员作用域只允许由附件管理签名接口签发。

`GET /api/attachments/management/:id/signed-url` 在签发前必须经过 `attachment:read` 校验。内容接口是匿名接口，只校验 HMAC、过期时间和签名载荷中的 `scope`，不依赖当前请求的 JWT，也不在读取阶段重新查询签发者权限。因此权限边界发生在签发阶段，签名本身是唯一凭据。

### 6.2 内容读取

管理页统一通过以下流程访问内容：

1. 调用附件管理签名接口获取 `admin` 作用域签名 URL。
2. 预览、打开和复制链接使用不带 `download` 的 URL。
3. 下载在签名 URL 后追加 `download=1`。
4. 内容接口继续校验签名、过期时间和作用域。

下载响应继续使用现有约定：

- 默认 `Content-Disposition: inline`。
- `download=1` 时返回 `Content-Disposition: attachment; filename*=UTF-8''<encoded originalName>`。
- `Content-Type` 使用附件元数据中的 MIME。

`storageKey` 和物理路径不返回前端。

## 7. 后端 API

新增附件管理入口，全部使用 `@Controller('attachments/management')`：

| 方法  | 路径                                           | 权限                | 说明                 |
| ----- | ---------------------------------------------- | ------------------- | -------------------- |
| GET   | `/api/attachments/management`                  | `attachment:read`   | 分页查询附件         |
| GET   | `/api/attachments/management/:id`              | `attachment:read`   | 查询附件详情         |
| GET   | `/api/attachments/management/:id/signed-url`   | `attachment:read`   | 获取管理员签名 URL   |
| PATCH | `/api/attachments/management/:id/visibility`   | `attachment:manage` | 修改未绑定附件可见性 |
| POST  | `/api/attachments/management/:id/soft-delete`  | `attachment:manage` | 软删除未绑定附件     |
| PATCH | `/api/attachments/management/bulk/visibility`  | `attachment:manage` | 批量修改可见性       |
| POST  | `/api/attachments/management/bulk/soft-delete` | `attachment:manage` | 批量软删除           |
| POST  | `/api/attachments/management/cleanup`          | `attachment:manage` | 触发附件清理任务     |

### 7.1 列表查询参数

| 参数             | 类型                 | 说明                             |
| ---------------- | -------------------- | -------------------------------- |
| `page`           | number               | 页码，默认 1                     |
| `pageSize`       | number               | 每页数量，默认 20，最大 100      |
| `keyword`        | string               | 按原始文件名模糊搜索             |
| `mimeType`       | string               | 精确筛选 MIME                    |
| `visibility`     | `private` / `public` | 可见性                           |
| `bizType`        | string               | 业务类型                         |
| `bizId`          | string               | 业务 ID                          |
| `uploader`       | string               | 上传人用户名或显示名模糊搜索     |
| `includeDeleted` | boolean              | 是否包含已软删除附件，默认 false |
| `orphanOnly`     | boolean              | 是否只查询未绑定孤儿附件         |
| `createdFrom`    | ISO 8601             | 创建时间下限                     |
| `createdTo`      | ISO 8601             | 创建时间上限                     |

`orphanOnly=true` 时只返回未绑定且未软删除的孤儿附件，忽略 `includeDeleted`。该组合不返回已软删除附件，避免“孤儿 + 已删除”状态重叠。

响应：

```ts
interface IAttachmentManagementPage {
  list: IAttachmentManagementItem[];
  total: number;
  page: number;
  pageSize: number;
}

interface IAttachmentManagementItem {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
  visibility: AttachmentVisibility;
  storageProvider: string;
  bizType: string | null;
  bizId: string | null;
  uploadedBy: {
    id: string;
    displayName: string;
  };
  status: "bound" | "orphan" | "deleted";
  cleanupStatus: "not_candidate" | "waiting" | "eligible";
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}
```

### 7.2 详情查询

详情返回列表字段，并补充：

- 管理员签名 URL 的获取入口。
- 绑定业务跳转所需的最小标识。
- 清理规则说明所需的保留期截止时间。

不返回 `storageKey`。

### 7.3 写操作规则

修改可见性和软删除只允许作用于未绑定且未软删除的附件。已绑定或已软删除附件返回冲突错误。

批量操作规则：

- 单次最多 100 条，ID 去重。
- 逐条返回成功或失败结果，部分失败不回滚其他成功项。
- 失败项包含附件 ID 和中文原因。

批量响应：

```ts
interface IAttachmentBulkResult {
  succeeded: string[];
  failed: {
    id: string;
    reason: string;
  }[];
}
```

### 7.4 清理任务

管理页触发清理时复用现有 `cleanup-attachments` job：

- 若已有同名 `queued`、`delayed` 或 `active` 任务，返回冲突，不重复入队。
- 成功返回新 job 记录，前端可跳转到任务中心查看进度和结果。
- 最近一次清理结果显示最新 `cleanup-attachments` job 的状态、进度和结果。

`POST /api/background-tasks/cleanup-attachments` 同时补上 `attachment:manage` 权限和去重逻辑，避免绕过管理页触发。

## 8. 前端页面

新增 `/management/attachments` 页面，“后台管理”侧边栏增加“附件管理”入口。入口和路由由 `attachment:read` 控制。

页面结构：

- 顶部筛选区。
- 服务端分页表格。
- 详情 Drawer。
- 批量操作栏。
- 最近清理任务卡片。

表格字段：

- 文件名、MIME、大小。
- 可见性。
- 绑定业务和业务 ID。
- 上传人。
- 附件状态。
- 清理状态。
- 创建时间、删除时间。
- 操作。

行操作：

- 查看详情。
- 复制链接。
- 预览。
- 打开。
- 下载。
- 修改可见性，仅未绑定且未删除。
- 软删除，仅未绑定且未删除。
- 跳转业务：文档跳转到文档详情，头像跳转到用户详情。

批量操作：

- 批量改为公开。
- 批量改为私有。
- 批量软删除。
- 展示成功数、失败数和失败原因。

无可访问附件时展示空状态，不展示误导性的零分页。

## 9. 审计与日志

不新增审计表。管理页写操作复用现有 `LoggerService`，记录：

- 操作人 ID。
- 附件 ID。
- 操作类型。
- 修改前、修改后值。
- 成功或失败结果。

触发清理任务记录 job ID。读取和下载沿用现有 HTTP 日志，不重复记录业务日志。

## 10. 数据与迁移

不新增附件表字段，不新增附件表。

现有附件索引覆盖 `bizType`、`bizId`、`deletedAt`、`createdAt` 和 `uploadedBy` 等主要筛选路径。文件名模糊搜索可能触发扫描，取舍与现有日志管理页一致，只对管理员开放。

新增权限数据通过现有 `db:seed` 同步，不新增独立迁移。

## 11. 测试与验收

### 11.1 服务端

- 普通用户访问全部附件管理接口返回 403。
- `admin` 可以查询、筛选、查看详情和下载任意附件。
- `admin` 可以读取他人私有和已软删除附件。
- 普通签名不能读取已软删除附件。
- 篡改 `scope=admin` 但使用普通签名会被拒绝。
- 已绑定附件修改可见性或软删除返回冲突。
- 未绑定附件修改可见性和软删除成功。
- 批量操作部分失败时返回逐条结果。
- 清理任务重复触发被拒绝。
- `background-tasks/cleanup-attachments` 对普通用户返回 403。
- `storageKey` 不出现在任何响应中。

### 11.2 前端

- 无 `attachment:read` 时菜单和路由不可访问。
- 有 `attachment:read` 无 `attachment:manage` 时写操作不可用。
- 筛选、分页、详情、复制、预览、打开和下载可用。
- `includeDeleted` 和 `orphanOnly` 筛选正确。
- 已绑定附件写操作禁用并有明确原因。
- 批量结果正确展示。
- 清理触发后能跳转到任务中心并查看最新结果。

### 11.3 手工验收

1. `admin` 登录，打开附件管理页，确认可以看到所有用户的附件。
2. 普通用户公开和私有附件分别出现在列表中。
3. 普通用户访问附件管理页，确认被拒绝。
4. 复制私有附件链接，确认链接在有效期内可打开。
5. 下载附件，确认文件名和内容正确。
6. 软删除一个文档附件，确认管理页能筛选到该附件，但普通文档附件签名不能读取。
7. 使用管理员签名读取已软删除附件，确认可以预览和下载。
8. 修改未绑定附件可见性，确认读取行为同步变化。
9. 尝试修改已绑定附件可见性或软删除，确认返回冲突。
10. 触发附件清理任务，重复触发，确认第二次被拒绝。
11. 在任务中心确认清理状态和结果可见。

## 12. 边界与后续

本设计不改变以下既有约束：

- 文档附件绑定、替换和移除仍由文档模块事务处理。
- 头像附件仍强制公开，仍由用户模块绑定和替换。
- 已绑定附件的物理文件仍由清理任务按保留期处理。
- 物理文件删除仍先删文件、再删元数据，失败项保留供重试。

对象存储、下载审计、限流和病毒扫描不在本次范围内。
