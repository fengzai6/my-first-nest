# 附件模块

附件模块统一处理文件上传、元数据持久化、业务绑定和内容访问。上传文件默认保存在本地磁盘，`IAttachmentStorage` 隔离存储实现，后续接入 OSS 时替换驱动即可，业务服务不需要改动。

## 存储方式

- `Attachment` 保存原始文件名、存储 key、MIME、大小、可见性、业务关联和上传人。
- `LocalAttachmentStorageService` 将 Multer 临时文件迁移到 `UPLOAD_DIR`，存储 key 使用 `YYYY/MM/<snowflake-id>.<extension>`。
- `storageProvider` 记录文件当前所在的存储提供方，便于后续本地存储与对象存储并存。
- 删除附件只软删除元数据；存储文件保留给后续清理任务处理。

## 访问规则

- 公开附件通过 `GET /api/attachments/content/:id` 直接读取，不需要登录。
- 私有附件通过 `GET /api/attachments/:id/signed-url` 获取签名 URL。
- 签名 URL 包含附件 ID、用户 ID、过期时间和 HMAC 签名，默认有效期 300 秒。
- 只有上传者或超级管理员可以获取私有附件签名 URL、更新未绑定附件的可见性或删除未绑定附件。
- 文档等业务附件由业务模块完成权限校验后签发 URL。
- 已绑定附件禁止通过通用删除或头像绑定接口操作。
- 浏览器的 `<img>` 请求不会携带 Bearer Token，因此私有图片必须使用签名 URL，不能直接使用受保护接口地址。

## 限制

- 通用附件单文件不超过 10 MB，单次最多 5 个。
- 支持图片、PDF、Office 文档和常见压缩包。
- 头像只允许 JPEG、PNG、WebP，单文件不超过 2 MB，并强制公开。

## 头像关联

头像通过 `bizType = user-avatar` 和 `bizId = userId` 关联用户。用户保存 `avatarAttachmentId` 后，服务端在同一事务中绑定附件、将公开地址写入 `users.avatar`，并软删除该用户之前的头像附件。

业务附件查询不提供通用 HTTP 接口。业务模块先完成业务对象权限校验，再调用 `AttachmentsService.findByBusiness()`。

## 物理清理

附件清理任务处理两类候选：

- 已软删除且 `deletedAt` 超过保留期的附件。
- 从未绑定业务且 `createdAt` 超过保留期的孤儿附件。

先删除物理文件，再硬删除附件元数据。文件不存在视为清理成功；单条失败不会中断整批，失败记录保留到下一次任务重试。

- `ATTACHMENT_CLEANUP_RETENTION_DAYS`：保留天数，默认 `7`，最小 `1`。
- `ATTACHMENT_CLEANUP_BATCH_SIZE`：单次查询最大条数，默认 `100`，范围 `1-1000`。
- 自动触发：每天 `03:00` 提交 `cleanup-attachments`。
- 手动触发：`POST /api/background-tasks/cleanup-attachments`。

同名任务已有 `queued`、`delayed` 或 `active` 记录时，自动触发会跳过。清理任务不提供回收站和人工恢复。

## API

| 方法   | 路径                              | 说明                       |
| ------ | --------------------------------- | -------------------------- |
| POST   | `/api/attachments`                | 上传一个或多个附件         |
| GET    | `/api/attachments/:id/signed-url` | 获取私有附件签名 URL       |
| GET    | `/api/attachments/content/:id`    | 读取公开附件或签名附件内容 |
| PATCH  | `/api/attachments/:id`            | 更新未绑定附件的可见性     |
| DELETE | `/api/attachments/:id`            | 软删除未绑定附件           |

`GET /api/attachments/content/:id` 默认返回 `Content-Disposition: inline`，适合图片等预览场景。传入 `download=1` 时返回 `Content-Disposition: attachment; filename*=UTF-8''<encoded originalName>`，并继续使用附件元数据中的 `Content-Type`。下载参数不会改变公开/私有附件的访问规则：公开附件无需签名，私有附件仍必须携带完整且有效的签名参数。
