# 附件物理清理任务设计

**日期：** 2026-09-16
**状态：** 设计已确认，待实现
**前置：** [2026-09-14-attachment-upload-design.md](./2026-09-14-attachment-upload-design.md)

---

## 1. 设计目标

在现有附件软删除策略基础上，增加可观察、可重试、幂等的物理清理任务：

- 清理超过保留期的已软删除附件。
- 清理从未绑定业务且超过保留期的孤儿附件。
- 删除物理文件后硬删除附件元数据。
- 执行过程和结果进入现有任务系统。

## 2. 范围

### 2.1 本次覆盖

- 附件物理清理服务和候选查询。
- 每天固定时间自动入队。
- 任务中心手动触发。
- 批量处理、失败隔离和幂等处理。
- 清理保留期配置、测试和文档。

### 2.2 本次不覆盖

- 对象存储清理。
- 文件版本、回收站和人工恢复。
- 按用户配额清理。
- 清理审计报表。
- 分布式锁和多实例调度的进一步抽象。

## 3. 核心决策

| 决策 | 结论 |
| --- | --- |
| 清理对象 1 | 已软删除且 `deletedAt` 超过保留期的附件 |
| 清理对象 2 | 从未绑定且 `createdAt` 超过保留期的附件 |
| 清理动作 | 先物理删除文件，再硬删除元数据 |
| 文件不存在 | 视为成功，继续删除元数据 |
| 单个失败 | 不中断整批，保留元数据，等待下次执行 |
| 批次大小 | 每次查询最多 100 条，循环处理直到无候选 |
| 自动触发 | 每天 03:00 通过 `@nestjs/schedule` 入队 |
| 手动触发 | 任务中心提供清理按钮 |
| 执行载体 | BullMQ + `job_runs`，复用 `shared/jobs` |
| 保留期 | `ATTACHMENT_CLEANUP_RETENTION_DAYS`，默认 7 天 |
| 幂等性 | 重复执行不得重复删除元数据或抛出文件不存在错误 |

## 4. 模块结构

```text
apps/server/src/modules/attachments/
├── services/
│   ├── local-attachment-storage.service.ts
│   └── attachment-cleanup.service.ts
├── dto/
│   └── cleanup-attachments.dto.ts
└── constants/
    └── attachment.constants.ts

apps/server/src/modules/background-tasks/handlers/
└── cleanup-attachments.handler.ts

apps/server/src/modules/scheduled-tasks/
└── cleanup-attachments.scheduler.ts
```

前端沿用现有任务中心，不新增独立清理页面。

## 5. 数据筛选

### 5.1 已软删除附件

条件：

- `deletedAt IS NOT NULL`
- `deletedAt <= now - retentionDays`

### 5.2 从未绑定的孤儿附件

条件：

- `bizType IS NULL`
- `bizId IS NULL`
- `deletedAt IS NULL`
- `createdAt <= now - retentionDays`

附件只要曾经绑定过，就不属于本任务的孤儿附件清理对象。

### 5.3 查询隔离

两类候选分分别查询、分别处理。每次每类最多取 100 条，按以下字段稳定排序：

1. `createdAt ASC`
2. `id ASC`

处理成功或文件不存在后删除元数据，下一轮查询自然推进。查询条件必须避免把当前批次中已处理的记录重复取出。

新增索引以支撑候选查询：

- `(deleted_at, created_at, id)` 用于已软删除附件。
- `(biz_type, biz_id, deleted_at, created_at)` 用于孤儿附件。

## 6. 清理流程

### 6.1 单批处理

对每条候选附件执行：

1. 读取 `storageKey`。
2. 调用 `IAttachmentStorage.remove(storageKey)`。
3. 删除成功或文件不存在时，硬删除附件元数据。
4. 记录单条结果。

`storage.remove()` 已对 `ENOENT` 做幂等处理，清理服务不重复捕获该错误。

### 6.2 循环处理

每轮处理两类候选：

1. 查询已软删除候选，处理最多 100 条。
2. 查询孤儿候选，处理最多 100 条。
3. 任意一类返回 100 条时继续下一轮。
4. 两类都少于 100 条时结束。

循环必须有安全上限，防止连续写入时任务永不结束。默认最多 100 轮，达到上限后返回已处理结果并记录安全限制。

### 6.3 失败隔离

单条附件处理失败时：

- 不中断当前批次。
- 不删除该附件元数据。
- 记录失败数量。
- 任务整体继续执行。

任务结果：

```ts
interface ICleanupAttachmentsResult {
  deletedMetadataCount: number;
  missingFileCount: number;
  failedCount: number;
  scannedCount: number;
  reachedSafetyLimit: boolean;
}
```

失败项在下次任务执行时重新进入候选集合。

## 7. 任务接入

### 7.1 Handler

新增 `CleanupAttachmentsHandler`，注册到任务系统：

```ts
readonly name = JOB_NAMES.CLEANUP_ATTACHMENTS;
```

执行时调用：

```ts
AttachmentsService.cleanupExpiredAttachments()
```

### 7.2 自动触发

新增 `CleanupAttachmentsScheduler`：

- `@Cron(CronExpression.EVERY_DAY_AT_3AM)`。
- 通过 `JobService.submit()` 入队。
- `triggerType = JOB_TRIGGER_TYPE.CRON`。
- 尝试次数为 3，退避时间为 2000 ms。
- payload 为空对象。

自动触发前检查 `job_runs` 中是否存在同名且状态为 `queued`、`delayed` 或 `active` 的任务。存在时跳过本次入队并记录日志，避免多实例或服务重启后重复堆积清理任务。

### 7.3 手动触发

新增后台任务接口：

```text
POST /api/background-tasks/cleanup-attachments
```

行为与 refresh token 清理接口一致：

- 需要登录。
- `triggerType = JOB_TRIGGER_TYPE.MANUAL`。
- 返回 task/job 记录。
- 任务中心可以查看状态、进度和结果。

### 7.4 任务中心

在现有任务触发面板增加“清理附件”操作。触发成功后按现有任务提交逻辑选中任务并刷新列表。

## 8. 配置

新增配置：

| 配置项 | 环境变量 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `upload.cleanupRetentionDays` | `ATTACHMENT_CLEANUP_RETENTION_DAYS` | `7` | 清理保留天数 |
| `upload.cleanupBatchSize` | `ATTACHMENT_CLEANUP_BATCH_SIZE` | `100` | 单次查询最大条数，必须为 1-1000 的正整数 |

`cleanupBatchSize` 默认值为 100，允许通过环境变量调整。实现必须对配置值做范围校验；非法值在启动阶段失败，不使用静默回退值。

## 9. 错误处理

| 场景 | 行为 |
| --- | --- |
| 单条物理文件不存在 | 计入 `missingFileCount`，继续删除元数据 |
| 单条物理删除失败 | 计入 `failedCount`，保留元数据，继续下一条 |
| 单条元数据硬删除失败 | 计入 `failedCount`，保留记录，交由下次重试 |
| 候选查询失败 | 任务失败，由 BullMQ 重试 |
| 自动任务重复候选 | 跳过本次入队并记录日志，不创建新的 `job_runs` |
| Redis 不可用 | 任务无法入队，返回现有任务系统错误 |

清理任务不抛出一部分已成功、一部分失败的聚合异常，避免已成功记录被误认为回滚。

## 10. 测试与验收

### 10.1 服务端单元测试

- 超过保留期的软删除附件会被物理删除并硬删除元数据。
- 未超过保留期的软删除附件不会被处理。
- 从未绑定且超过保留期的孤儿附件会被处理。
- 已绑定附件不会被孤儿清理处理。
- 曾经绑定过但后来解除绑定的附件不会被孤儿清理处理。
- 文件不存在时仍删除元数据，并计入 `missingFileCount`。
- 单条失败不阻断其他候选，失败记录保留，`failedCount` 正确。
- 批量处理遇到 100 条时继续循环，达到安全上限时设置 `reachedSafetyLimit`。
- 重复执行不会重复删除或抛出元数据不存在错误。

### 10.2 任务测试

- 定时任务每天 03:00 提交 `cleanup-attachments` job。
- 已有同名 queued、delayed 或 active 任务时，自动触发不会创建重复任务。
- 手动触发接口提交 `cleanup-attachments` job。
- 任务成功结果包含处理数量、缺失文件数量、失败数量和安全限制标记。
- 任务失败时 `job_runs` 记录失败原因。

### 10.3 手工验收

1. 手动软删除一个附件，调整保留期使其进入候选，触发清理任务，确认物理文件被删除。
2. 创建一个超过保留期从未绑定的附件，触发清理任务，确认文件和元数据均被删除。
3. 模拟文件不存在，触发清理任务，确认元数据删除且 `missingFileCount` 增加。
4. 模拟单条文件删除失败，确认失败项保留且其他候选继续处理。
5. 在任务中心确认自动和手动清理任务均出现执行记录。

## 11. 后续边界

文档业务闭环由独立的资料文档附件业务闭环设计处理。本任务不负责业务绑定、权限校验和前端文档页面。
