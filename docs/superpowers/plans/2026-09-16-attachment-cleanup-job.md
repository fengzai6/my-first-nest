# 附件物理清理任务 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 增加可重试、可观察、幂等的附件物理清理任务，删除超过保留期的软删除附件和从未绑定的孤儿附件，并接入自动定时触发、任务中心和前端任务中心。

**Architecture:** `AttachmentCleanupService` 根据配置分页查询两类候选，逐条调用存储驱动删除物理文件，成功后硬删除附件元数据。清理逻辑通过 `AttachmentsService.cleanupExpiredAttachments()` 暴露给 BullMQ handler；每天 03:00 的 scheduler 先检查同名任务是否处于 queued、delayed 或 active，再提交清理任务。手动触发复用现有 `/api/background-tasks` 和任务中心。

**Tech Stack:** NestJS 11、TypeORM、PostgreSQL、BullMQ、`@nestjs/bullmq`、`@nestjs/schedule`、Vitest、React 19、Ant Design 6、TanStack Query。

**Spec:** [2026-09-16-attachment-cleanup-job-design.md](../specs/2026-09-16-attachment-cleanup-job-design.md)

## Global Constraints

- 响应统一使用简体中文。
- 文件/目录使用 kebab-case；React 组件使用命名导出。
- 清理对象固定为两类：
  - `deletedAt IS NOT NULL AND deletedAt <= now - retentionDays`
  - `bizType IS NULL AND bizId IS NULL AND deletedAt IS NULL AND createdAt <= now - retentionDays`
- 处理顺序固定为：先删除物理文件，再硬删除附件元数据。
- 文件不存在视为清理成功，返回 `missingFileCount + 1`，并继续删除元数据。
- 单条失败不阻断整批；失败记录保留，等待下一次任务重试。
- 默认保留 7 天，环境变量为 `ATTACHMENT_CLEANUP_RETENTION_DAYS`，最小 1。
- 默认批大小 100，环境变量为 `ATTACHMENT_CLEANUP_BATCH_SIZE`，范围 1-1000。
- 每轮分别查询两类候选；任意一类返回满批时继续，默认最多执行 100 轮。
- 自动任务每天 03:00 通过 `@nestjs/schedule` 提交 BullMQ；自动触发时同名任务处于 `queued`、`delayed` 或 `active` 则跳过。
- BullMQ attempts 固定为 3，backoff 固定为 2000 ms。
- 手动触发接口需要登录，复用现有任务系统，不新增独立清理页面。
- 本计划与 [2026-09-16-document-attachment-workflow.md](./2026-09-16-document-attachment-workflow.md) 都会修改附件 service、entity、README 和附件测试。推荐先执行文档闭环计划，再执行本计划。若先执行本计划，后续文档计划必须保留 `cleanupExpiredAttachments()`、清理索引和 `remove(): Promise<boolean>` 契约。
- 本计划不执行 `git add`、`git commit`、`git push`、建分支或开 PR。

---

## File Structure

**服务端新增**

- `apps/server/src/modules/attachments/services/attachment-cleanup.service.ts`：候选查询、物理删除、元数据硬删除、失败隔离和循环控制。
- `apps/server/src/modules/background-tasks/handlers/cleanup-attachments.handler.ts`：将清理服务注册为 BullMQ job handler。
- `apps/server/src/modules/scheduled-tasks/cleanup-attachments.scheduler.ts`：每天 03:00 提交清理任务，并抑制重复任务。
- `apps/server/database/migrations/20260916110000-add-attachment-cleanup-indexes.ts`：新增清理候选查询索引。
- `apps/server/tests/unit/modules/attachments/attachment-cleanup.service.spec.ts`
- `apps/server/tests/unit/modules/background-tasks/handlers/cleanup-attachments.handler.spec.ts`
- `apps/server/tests/unit/modules/scheduled-tasks/cleanup-attachments.scheduler.spec.ts`

**服务端修改**

- `apps/server/src/config/configuration.interface.ts`：增加清理保留期和批大小配置。
- `apps/server/src/config/config.default.ts`：增加清理配置默认值。
- `apps/server/src/config/env.validation.ts`：校验清理环境变量和范围。
- `apps/server/src/modules/attachments/interfaces/attachment-storage.interface.ts`：让 `remove()` 返回是否实际删除了文件。
- `apps/server/src/modules/attachments/services/local-attachment-storage.service.ts`：删除成功返回 `true`，`ENOENT` 返回 `false`。
- `apps/server/src/modules/attachments/attachments.service.ts`：注入清理服务并暴露 `cleanupExpiredAttachments()`。
- `apps/server/src/modules/attachments/attachments.module.ts`：注册并导出清理服务。
- `apps/server/src/modules/attachments/entities/attachment.entity.ts`：增加清理候选索引声明。
- `apps/server/src/modules/background-tasks/background-tasks.controller.ts`：增加手动清理接口。
- `apps/server/src/modules/background-tasks/background-tasks.module.ts`：注册清理 handler。
- `apps/server/src/modules/scheduled-tasks/scheduled-tasks.module.ts`：注册清理 scheduler。
- `apps/server/src/shared/jobs/constants/job.constants.ts`：增加 `CLEANUP_ATTACHMENTS` 名称。
- `apps/server/src/shared/jobs/services/job.service.ts`：增加同名 queued / delayed / active 查询。
- `apps/server/src/shared/jobs/records/job-record.service.ts`：支持按状态集合判断同名任务是否存在。
- `apps/server/tests/unit/config/env.validation.spec.ts`
- `apps/server/tests/unit/modules/attachments/local-attachment-storage.service.spec.ts`
- `apps/server/tests/unit/modules/attachments/attachments.service.spec.ts`
- `apps/server/tests/unit/shared/jobs/services/job.service.spec.ts`

**前端修改**

- `apps/web/src/services/types/job.ts`：增加 `CLEANUP_ATTACHMENTS` 名称。
- `apps/web/src/services/api/background-tasks.ts`：增加手动清理请求。
- `apps/web/src/components/jobs/job-trigger-panel/index.tsx`：增加“清理附件”按钮。
- `apps/web/src/pages/jobs/index.tsx`：接入手动清理 mutation。

**文档修改**

- `apps/server/src/modules/attachments/README.md`
- `apps/docs/src/notes/attachments.md`
- `apps/server/src/shared/jobs/README.md`

---

### Task 1: 清理配置、存储契约和索引

**Files:**

- Modify: `apps/server/src/config/configuration.interface.ts`
- Modify: `apps/server/src/config/config.default.ts`
- Modify: `apps/server/src/config/env.validation.ts`
- Modify: `apps/server/src/modules/attachments/interfaces/attachment-storage.interface.ts`
- Modify: `apps/server/src/modules/attachments/services/local-attachment-storage.service.ts`
- Modify: `apps/server/src/modules/attachments/entities/attachment.entity.ts`
- Modify: `apps/server/tests/unit/config/env.validation.spec.ts`
- Modify: `apps/server/tests/unit/modules/attachments/local-attachment-storage.service.spec.ts`
- Create: `apps/server/database/migrations/20260916110000-add-attachment-cleanup-indexes.ts`

**Interfaces:**

- Consumes: `UploadConfig`、`IAttachmentStorage`、现有 `attachments` 表。
- Produces:

```ts
export interface UploadConfig {
  // existing fields
  cleanupRetentionDays?: number;
  cleanupBatchSize?: number;
}

export interface IAttachmentStorage {
  remove(key: string): Promise<boolean>;
}
```

- `remove()` 返回 `true` 表示本次实际删除了文件，返回 `false` 表示文件不存在。

- [ ] **Step 1: 先修改配置测试和存储测试**

在 `env.validation.spec.ts` 增加：

```ts
it('rejects an attachment cleanup batch size above 1000', () => {
  const result = validationSchema.validate({
    DEFAULT_ADMIN_USERNAME: 'admin',
    DEFAULT_ADMIN_PASSWORD: 'password',
    JWT_SECRET: 'secret',
    DATABASE_HOST: 'localhost',
    DATABASE_PORT: 5432,
    DATABASE_USERNAME: 'postgres',
    DATABASE_PASSWORD: 'postgres',
    DATABASE_NAME: 'test',
    ATTACHMENT_CLEANUP_BATCH_SIZE: 1001,
  });

  expect(result.error).toBeDefined();
});

it('uses attachment cleanup defaults', () => {
  const result = validationSchema.validate({
    DEFAULT_ADMIN_USERNAME: 'admin',
    DEFAULT_ADMIN_PASSWORD: 'password',
    JWT_SECRET: 'secret',
    DATABASE_HOST: 'localhost',
    DATABASE_PORT: 5432,
    DATABASE_USERNAME: 'postgres',
    DATABASE_PASSWORD: 'postgres',
    DATABASE_NAME: 'test',
  });

  expect(result.value.ATTACHMENT_CLEANUP_RETENTION_DAYS).toBe(7);
  expect(result.value.ATTACHMENT_CLEANUP_BATCH_SIZE).toBe(100);
});
```

在 `local-attachment-storage.service.spec.ts` 增加：

```ts
it('returns false when removing a missing file', async () => {
  await expect(service.remove('2026/09/missing.png')).resolves.toBe(false);
});

it('returns true when removing an existing file', async () => {
  const key = '2026/09/existing.txt';
  const absolutePath = join(uploadDir, key);
  await writeFile(absolutePath, 'content');

  await expect(service.remove(key)).resolves.toBe(true);
  await expect(stat(absolutePath)).rejects.toThrow();
});
```

Run:

```bash
yarn workspace @my-first-nest/server test tests/unit/config/env.validation.spec.ts
yarn workspace @my-first-nest/server test tests/unit/modules/attachments/local-attachment-storage.service.spec.ts
```

Expected: FAIL，清理配置默认值和 `remove()` 布尔返回值尚未实现。

- [ ] **Step 2: 增加配置和校验**

`configuration.interface.ts` 的 `UploadConfig` 加入：

```ts
/** 已删除或孤儿附件的最短保留天数 */
cleanupRetentionDays?: number;
/** 每次候选查询最大条数，范围 1-1000 */
cleanupBatchSize?: number;
```

`config.default.ts` 的 `upload` 加入：

```ts
cleanupRetentionDays: parseNumberEnv(
  process.env.ATTACHMENT_CLEANUP_RETENTION_DAYS,
  7,
),
cleanupBatchSize: parseNumberEnv(
  process.env.ATTACHMENT_CLEANUP_BATCH_SIZE,
  100,
),
```

`env.validation.ts` 加入：

```ts
// Attachment cleanup
ATTACHMENT_CLEANUP_RETENTION_DAYS: Joi.number()
  .integer()
  .min(1)
  .default(7),
ATTACHMENT_CLEANUP_BATCH_SIZE: Joi.number()
  .integer()
  .min(1)
  .max(1000)
  .default(100),
```

- [ ] **Step 3: 修改存储删除契约**

`attachment-storage.interface.ts`：

```ts
export interface IAttachmentStorage {
  save(file: Express.Multer.File): Promise<IStoredFile>;
  read(key: string): Promise<IReadableStoredFile>;
  remove(key: string): Promise<boolean>;
  cleanup(file: Express.Multer.File): Promise<void>;
}
```

`LocalAttachmentStorageService.remove()`：

```ts
async remove(key: string): Promise<boolean> {
  try {
    await unlink(this.resolveKey(key));
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }
    return false;
  }
}
```

上传失败回滚继续调用 `storage.remove(key)`，忽略布尔返回值。

- [ ] **Step 4: 增加实体索引和迁移**

将 `Attachment` 的原有业务索引替换为两个显式命名索引：

```ts
@Entity('attachments')
@Index('IDX_attachments_cleanup_deleted', [
  'deletedAt',
  'createdAt',
  'id',
])
@Index('IDX_attachments_orphan_cleanup', [
  'bizType',
  'bizId',
  'deletedAt',
  'createdAt',
])
@Index(['uploadedBy', 'visibility', 'deletedAt'])
export class Attachment extends BaseEntity {}
```

迁移 `up()`：

```sql
DROP INDEX IF EXISTS "IDX_attachments_biz";

CREATE INDEX "IDX_attachments_cleanup_deleted"
  ON "attachments" ("deleted_at", "created_at", "id");

CREATE INDEX "IDX_attachments_orphan_cleanup"
  ON "attachments" ("biz_type", "biz_id", "deleted_at", "created_at");
```

迁移 `down()`：

```sql
DROP INDEX "IDX_attachments_orphan_cleanup";
DROP INDEX "IDX_attachments_cleanup_deleted";

CREATE INDEX "IDX_attachments_biz"
  ON "attachments" ("biz_type", "biz_id", "deleted_at");
```

- [ ] **Step 5: 运行配置和存储测试**

Run:

```bash
yarn workspace @my-first-nest/server test tests/unit/config/env.validation.spec.ts
yarn workspace @my-first-nest/server test tests/unit/modules/attachments/local-attachment-storage.service.spec.ts
yarn workspace @my-first-nest/server type-check
yarn workspace @my-first-nest/server db:migrate
```

Expected: PASS。

---

### Task 2: 清理候选查询和单条幂等删除

**Files:**

- Create: `apps/server/src/modules/attachments/services/attachment-cleanup.service.ts`
- Create: `apps/server/tests/unit/modules/attachments/attachment-cleanup.service.spec.ts`

**Interfaces:**

- Consumes: `Attachment` repository、`IAttachmentStorage`、`UploadConfig`。
- Produces:

```ts
export interface ICleanupAttachmentsResult {
  deletedMetadataCount: number;
  missingFileCount: number;
  failedCount: number;
  scannedCount: number;
  reachedSafetyLimit: boolean;
}

cleanupExpiredAttachments(now?: Date): Promise<ICleanupAttachmentsResult>;
```

固定常量：

```ts
const CLEANUP_MAX_ROUNDS = 100;
```

查询边界统一由同一个 `now` 生成：

```ts
const currentTime = now ?? new Date();
const cutoff = new Date(
  currentTime.getTime() -
    this.retentionDays * 24 * 60 * 60 * 1000,
);
```

两类候选查询都接收 `excludedIds`，用于跳过本次执行中已经失败的记录：

```ts
private async findDeletedCandidates(
  cutoff: Date,
  excludedIds: string[],
): Promise<Attachment[]> {
  const query = this.attachmentRepository
    .createQueryBuilder('attachment')
    .withDeleted()
    .where('attachment.deletedAt IS NOT NULL')
    .andWhere('attachment.deletedAt <= :cutoff', { cutoff })
    .orderBy('attachment.createdAt', 'ASC')
    .addOrderBy('attachment.id', 'ASC')
    .take(this.batchSize);

  if (excludedIds.length > 0) {
    query.andWhere('attachment.id NOT IN (:...excludedIds)', {
      excludedIds,
    });
  }

  return query.getMany();
}
```

孤儿候选查询使用同样的 `excludedIds` 条件。

软删除候选：

```ts
return this.attachmentRepository
  .createQueryBuilder('attachment')
  .withDeleted()
  .where('attachment.deletedAt IS NOT NULL')
  .andWhere('attachment.deletedAt <= :cutoff', { cutoff })
  .orderBy('attachment.createdAt', 'ASC')
  .addOrderBy('attachment.id', 'ASC')
  .take(this.batchSize)
  .getMany();
```

孤儿候选：

```ts
return this.attachmentRepository
  .createQueryBuilder('attachment')
  .where('attachment.bizType IS NULL')
  .andWhere('attachment.bizId IS NULL')
  .andWhere('attachment.deletedAt IS NULL')
  .andWhere('attachment.createdAt <= :cutoff', { cutoff })
  .orderBy('attachment.createdAt', 'ASC')
  .addOrderBy('attachment.id', 'ASC')
  .take(this.batchSize)
  .getMany();
```

单条处理：

```ts
private async cleanupAttachment(
  attachment: Attachment,
): Promise<{
  deleted: boolean;
  missing: boolean;
  failed: boolean;
}> {
  try {
    const fileRemoved = await this.storage.remove(attachment.storageKey);
    await this.attachmentRepository.delete(attachment.id);

    return {
      deleted: true,
      missing: !fileRemoved,
      failed: false,
    };
  } catch {
    return {
      deleted: false,
      missing: false,
      failed: true,
    };
  }
}
```

`repository.delete()` 返回 `affected: 0` 仍视为幂等成功，因为该元数据已经被其他执行删除。

- [ ] **Step 1: 编写清理服务失败测试**

创建 `attachment-cleanup.service.spec.ts`，至少覆盖：

```ts
it('deletes a soft-deleted attachment after the retention period', async () => {
  const { service, storage, repository, queryBuilder } = createService();
  const attachment = createAttachment({
    id: 'deleted-id',
    storageKey: '2026/09/deleted.png',
    deletedAt: new Date('2026-09-01T00:00:00.000Z'),
  });

  queryBuilder.getMany
    .mockResolvedValueOnce([attachment])
    .mockResolvedValueOnce([]);
  storage.remove.mockResolvedValue(true);
  repository.delete.mockResolvedValue({ affected: 1 });

  const result = await service.cleanupExpiredAttachments(
    new Date('2026-09-16T03:00:00.000Z'),
  );

  expect(storage.remove).toHaveBeenCalledWith('2026/09/deleted.png');
  expect(repository.delete).toHaveBeenCalledWith('deleted-id');
  expect(result).toEqual({
    deletedMetadataCount: 1,
    missingFileCount: 0,
    failedCount: 0,
    scannedCount: 1,
    reachedSafetyLimit: false,
  });
});

it('deletes metadata when the physical file is already missing', async () => {
  const { service, storage, repository, queryBuilder } = createService();
  queryBuilder.getMany
    .mockResolvedValueOnce([createAttachment()])
    .mockResolvedValueOnce([]);
  storage.remove.mockResolvedValue(false);

  const result = await service.cleanupExpiredAttachments(
    new Date('2026-09-16T03:00:00.000Z'),
  );

  expect(repository.delete).toHaveBeenCalledWith('attachment-id');
  expect(result.missingFileCount).toBe(1);
  expect(result.deletedMetadataCount).toBe(1);
});

it('keeps metadata and continues when one attachment fails', async () => {
  const { service, storage, repository, queryBuilder } = createService();
  const failed = createAttachment({ id: 'failed-id' });
  const success = createAttachment({ id: 'success-id' });

  queryBuilder.getMany
    .mockResolvedValueOnce([failed, success])
    .mockResolvedValueOnce([]);
  storage.remove
    .mockRejectedValueOnce(new Error('disk unavailable'))
    .mockResolvedValueOnce(true);

  const result = await service.cleanupExpiredAttachments(
    new Date('2026-09-16T03:00:00.000Z'),
  );

  expect(repository.delete).toHaveBeenCalledTimes(1);
  expect(repository.delete).toHaveBeenCalledWith('success-id');
  expect(result.failedCount).toBe(1);
  expect(result.deletedMetadataCount).toBe(1);
});

it('keeps querying until both candidate types return less than a full batch', async () => {
  const { service, queryBuilder } = createService({ batchSize: 2 });

  queryBuilder.getMany
    .mockResolvedValueOnce([
      createAttachment({ id: 'deleted-1' }),
      createAttachment({ id: 'deleted-2' }),
    ])
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([createAttachment({ id: 'deleted-3' })])
    .mockResolvedValueOnce([]);

  const result = await service.cleanupExpiredAttachments(
    new Date('2026-09-16T03:00:00.000Z'),
  );

  expect(result.scannedCount).toBe(3);
  expect(queryBuilder.getMany).toHaveBeenCalledTimes(4);
});

it('sets reachedSafetyLimit when the safety round cap is reached', async () => {
  const { service, queryBuilder } = createService({
    batchSize: 1,
    maxRounds: 2,
  });

  queryBuilder.getMany
    .mockResolvedValue([createAttachment()]);

  const result = await service.cleanupExpiredAttachments(
    new Date('2026-09-16T03:00:00.000Z'),
  );

  expect(result.reachedSafetyLimit).toBe(true);
});
```

测试 helper 通过 `cleanupExpiredAttachments(now)` 传入固定时间；不要在测试里重写清理循环逻辑。

Run:

```bash
yarn workspace @my-first-nest/server test tests/unit/modules/attachments/attachment-cleanup.service.spec.ts
```

Expected: FAIL，清理服务尚不存在。

- [ ] **Step 2: 实现清理服务**

创建 `AttachmentCleanupService`。构造函数从 `ConfigService` 读取：

```ts
const config = getConfig(configService);
this.retentionDays = config.upload.cleanupRetentionDays;
this.batchSize = config.upload.cleanupBatchSize;
```

循环实现必须按以下顺序：

```ts
let scannedCount = 0;
let deletedMetadataCount = 0;
let missingFileCount = 0;
let failedCount = 0;
let rounds = 0;
let reachedSafetyLimit = false;

const failedIds = new Set<string>();

while (rounds < this.maxRounds) {
  rounds += 1;

  const deletedCandidates = await this.findDeletedCandidates(
    cutoff,
    [...failedIds],
  );
  const orphanCandidates = await this.findOrphanCandidates(
    cutoff,
    [...failedIds],
  );

  if (deletedCandidates.length === 0 && orphanCandidates.length === 0) {
    break;
  }

  const candidates = [...deletedCandidates, ...orphanCandidates];
  scannedCount += candidates.length;

  for (const attachment of candidates) {
    const outcome = await this.cleanupAttachment(attachment);
    if (outcome.deleted) deletedMetadataCount += 1;
    if (outcome.missing) missingFileCount += 1;
    if (outcome.failed) {
      failedCount += 1;
      failedIds.add(attachment.id);
    }
  }

  const hasFullBatch =
    deletedCandidates.length >= this.batchSize ||
    orphanCandidates.length >= this.batchSize;

  if (!hasFullBatch) break;

  if (rounds === this.maxRounds) {
    reachedSafetyLimit = true;
  }
}

return {
  deletedMetadataCount,
  missingFileCount,
  failedCount,
  scannedCount,
  reachedSafetyLimit,
};
```

构造函数保留可测试的轮次上限属性：

```ts
constructor(
  @InjectRepository(Attachment)
  private readonly attachmentRepository: Repository<Attachment>,
  @Inject(ATTACHMENT_STORAGE)
  private readonly storage: IAttachmentStorage,
  configService: ConfigService,
) {}

protected readonly maxRounds = CLEANUP_MAX_ROUNDS;
```

安全上限测试通过子类覆盖 `maxRounds = 2`，不要为了测试给 Nest 构造函数注入原始 `number` provider。

测试 helper 固定按以下方式构造，不绕过被测实现：

```ts
const service = new AttachmentCleanupService(
  repository as never,
  storage,
  createConfigService({ cleanupRetentionDays: 7, cleanupBatchSize: batchSize }),
);
```

安全上限测试使用：

```ts
class TestCleanupService extends AttachmentCleanupService {
  protected readonly maxRounds = 2;
}
```

- [ ] **Step 3: 运行清理服务测试**

Run:

```bash
yarn workspace @my-first-nest/server test tests/unit/modules/attachments/attachment-cleanup.service.spec.ts
```

Expected: PASS。

---

### Task 3: 清理 job、handler 和手动触发接口

**Files:**

- Create: `apps/server/src/modules/background-tasks/handlers/cleanup-attachments.handler.ts`
- Create: `apps/server/tests/unit/modules/background-tasks/handlers/cleanup-attachments.handler.spec.ts`
- Modify: `apps/server/src/shared/jobs/constants/job.constants.ts`
- Modify: `apps/server/src/modules/attachments/attachments.service.ts`
- Modify: `apps/server/src/modules/attachments/attachments.module.ts`
- Modify: `apps/server/src/modules/background-tasks/background-tasks.controller.ts`
- Modify: `apps/server/src/modules/background-tasks/background-tasks.module.ts`
- Modify: `apps/server/tests/unit/modules/attachments/attachments.service.spec.ts`

**Interfaces:**

- Consumes: `AttachmentCleanupService.cleanupExpiredAttachments()`。
- Produces:

```ts
export const JOB_NAMES = {
  // existing jobs
  CLEANUP_ATTACHMENTS: 'cleanup-attachments',
} as const;

cleanupExpiredAttachments(
  now?: Date,
): Promise<ICleanupAttachmentsResult>;
```

Handler：

```ts
@Injectable()
export class CleanupAttachmentsHandler
  implements IJobHandler<Record<string, never>, ICleanupAttachmentsResult>
{
  readonly name = JOB_NAMES.CLEANUP_ATTACHMENTS;

  constructor(
    registry: JobRegistryService,
    private readonly attachmentsService: AttachmentsService,
  ) {
    registry.register(this);
  }

  async handle(
    ctx: IJobContext<Record<string, never>>,
  ): Promise<ICleanupAttachmentsResult> {
    await ctx.updateProgress(10);
    const result = await this.attachmentsService.cleanupExpiredAttachments();
    await ctx.updateProgress(100);
    return result;
  }
}
```

`AttachmentsService` 增加：

```ts
constructor(
  // existing dependencies
  private readonly cleanupService: AttachmentCleanupService,
) {}

cleanupExpiredAttachments(
  now?: Date,
): Promise<ICleanupAttachmentsResult> {
  return this.cleanupService.cleanupExpiredAttachments(now);
}
```

`AttachmentsModule` 注册 `AttachmentCleanupService` 并提供给 `AttachmentsService`；模块导出 `AttachmentsService` 即可。

手动接口：

```ts
@Post('cleanup-attachments')
@ApiOperation({
  summary: '手动触发附件物理清理',
  description:
    '删除超过保留期的软删除附件和从未绑定的孤儿附件，最多重试 3 次',
})
cleanupAttachments(@UserInfo() user: User) {
  return this.jobService.submit({
    name: JOB_NAMES.CLEANUP_ATTACHMENTS,
    payload: {},
    attempts: 3,
    backoffMs: 2000,
    triggerType: JOB_TRIGGER_TYPE.MANUAL,
    createdBy: user.id,
  });
}
```

- [ ] **Step 1: 编写 handler 和 service 委托测试**

`cleanup-attachments.handler.spec.ts`：

```ts
it('registers and delegates cleanup to AttachmentsService', async () => {
  const register = vi.fn();
  const cleanupResult = {
    deletedMetadataCount: 2,
    missingFileCount: 1,
    failedCount: 0,
    scannedCount: 3,
    reachedSafetyLimit: false,
  };
  const cleanupExpiredAttachments = vi.fn().mockResolvedValue(cleanupResult);
  const handler = new CleanupAttachmentsHandler(
    { register } as unknown as JobRegistryService,
    { cleanupExpiredAttachments } as unknown as AttachmentsService,
  );

  expect(register).toHaveBeenCalledWith(handler);
  expect(handler.name).toBe(JOB_NAMES.CLEANUP_ATTACHMENTS);

  const updateProgress = vi.fn().mockResolvedValue(undefined);
  const result = await handler.handle({
    jobId: 'job-id',
    name: JOB_NAMES.CLEANUP_ATTACHMENTS,
    payload: {},
    attemptsMade: 1,
    maxAttempts: 3,
    updateProgress,
  });

  expect(updateProgress).toHaveBeenCalledWith(10);
  expect(cleanupExpiredAttachments).toHaveBeenCalledTimes(1);
  expect(updateProgress).toHaveBeenCalledWith(100);
  expect(result).toEqual(cleanupResult);
});
```

在 `attachments.service.spec.ts` 的 `createService()` 中增加清理服务 mock，并增加：

```ts
it('delegates attachment cleanup to the cleanup service', async () => {
  const { service, cleanupExpiredAttachments } = createService();
  const result = {
    deletedMetadataCount: 1,
    missingFileCount: 0,
    failedCount: 0,
    scannedCount: 1,
    reachedSafetyLimit: false,
  };
  cleanupExpiredAttachments.mockResolvedValue(result);

  await expect(service.cleanupExpiredAttachments()).resolves.toBe(result);
});
```

Run:

```bash
yarn workspace @my-first-nest/server test tests/unit/modules/background-tasks/handlers/cleanup-attachments.handler.spec.ts
yarn workspace @my-first-nest/server test tests/unit/modules/attachments/attachments.service.spec.ts
```

Expected: FAIL，job 名称、handler 或 service 委托尚未实现。

- [ ] **Step 2: 注册 job 名称和 handler**

在 `JOB_NAMES` 中加入 `CLEANUP_ATTACHMENTS`，在 `BackgroundTasksModule` 的 `providers` 注册 `CleanupAttachmentsHandler`。

- [ ] **Step 3: 增加手动接口**

控制器继续使用现有 `JobService.submit()`，不直接操作 BullMQ 或 `job_runs`。

- [ ] **Step 4: 运行相关测试**

Run:

```bash
yarn workspace @my-first-nest/server test tests/unit/modules/background-tasks/handlers/cleanup-attachments.handler.spec.ts
yarn workspace @my-first-nest/server test tests/unit/modules/attachments/attachments.service.spec.ts
yarn workspace @my-first-nest/server type-check
```

Expected: PASS。

---

### Task 4: 自动定时触发和重复任务抑制

**Files:**

- Create: `apps/server/src/modules/scheduled-tasks/cleanup-attachments.scheduler.ts`
- Create: `apps/server/tests/unit/modules/scheduled-tasks/cleanup-attachments.scheduler.spec.ts`
- Modify: `apps/server/src/modules/scheduled-tasks/scheduled-tasks.module.ts`
- Modify: `apps/server/src/shared/jobs/services/job.service.ts`
- Modify: `apps/server/src/shared/jobs/records/job-record.service.ts`
- Modify: `apps/server/tests/unit/shared/jobs/services/job.service.spec.ts`

**Interfaces:**

- Consumes: `JobService.submit()`、`JobRecordService`、`JOB_STATUS`。
- Produces:

```ts
hasActiveOrPending(name: string): Promise<boolean>;
```

任务状态检查：

```ts
async hasActiveOrPending(name: string): Promise<boolean> {
  return this.jobRunRepository.exists({
    where: {
      name,
      status: In([
        JOB_STATUS.QUEUED,
        JOB_STATUS.DELAYED,
        JOB_STATUS.ACTIVE,
      ]),
    },
  });
}
```

Scheduler：

```ts
@Injectable()
export class CleanupAttachmentsScheduler {
  constructor(
    private readonly jobService: JobService,
    private readonly logger: LoggerService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async handleCleanup() {
    const hasActiveOrPending =
      await this.jobService.hasActiveOrPending(
        JOB_NAMES.CLEANUP_ATTACHMENTS,
      );

    if (hasActiveOrPending) {
      this.logger.log('Attachment cleanup enqueue skipped', {
        category: LOG_CATEGORY.SCHEDULED_TASK,
        context: {
          name: JOB_NAMES.CLEANUP_ATTACHMENTS,
          reason: 'active-or-pending',
        },
      });
      return;
    }

    const job = await this.jobService.submit({
      name: JOB_NAMES.CLEANUP_ATTACHMENTS,
      payload: {},
      attempts: 3,
      backoffMs: 2000,
      triggerType: JOB_TRIGGER_TYPE.CRON,
    });

    this.logger.log('Attachment cleanup enqueued', {
      category: LOG_CATEGORY.SCHEDULED_TASK,
      context: { jobId: job.id },
    });
  }
}
```

- [ ] **Step 1: 编写重复任务和 scheduler 失败测试**

在 `job.service.spec.ts` 增加：

```ts
it('reports whether a job name has an active or pending run', async () => {
  const { service, records } = createService();
  records.hasActiveOrPending.mockResolvedValue(true);

  await expect(
    service.hasActiveOrPending(JOB_NAMES.CLEANUP_ATTACHMENTS),
  ).resolves.toBe(true);
  expect(records.hasActiveOrPending).toHaveBeenCalledWith(
    JOB_NAMES.CLEANUP_ATTACHMENTS,
  );
});
```

创建 `cleanup-attachments.scheduler.spec.ts`：

```ts
it('submits a cron cleanup job when no active or pending job exists', async () => {
  const jobService = {
    hasActiveOrPending: vi.fn().mockResolvedValue(false),
    submit: vi.fn().mockResolvedValue({ id: 'job-id' }),
  };
  const logger = { log: vi.fn() };
  const scheduler = new CleanupAttachmentsScheduler(
    jobService as unknown as JobService,
    logger as never,
  );

  await scheduler.handleCleanup();

  expect(jobService.submit).toHaveBeenCalledWith({
    name: JOB_NAMES.CLEANUP_ATTACHMENTS,
    payload: {},
    attempts: 3,
    backoffMs: 2000,
    triggerType: JOB_TRIGGER_TYPE.CRON,
  });
});

it('skips submission when an active or pending cleanup job exists', async () => {
  const jobService = {
    hasActiveOrPending: vi.fn().mockResolvedValue(true),
    submit: vi.fn(),
  };
  const logger = { log: vi.fn() };
  const scheduler = new CleanupAttachmentsScheduler(
    jobService as unknown as JobService,
    logger as never,
  );

  await scheduler.handleCleanup();

  expect(jobService.submit).not.toHaveBeenCalled();
  expect(logger.log).toHaveBeenCalledWith(
    'Attachment cleanup enqueue skipped',
    expect.objectContaining({
      category: LOG_CATEGORY.SCHEDULED_TASK,
    }),
  );
});
```

Run:

```bash
yarn workspace @my-first-nest/server test tests/unit/shared/jobs/services/job.service.spec.ts
yarn workspace @my-first-nest/server test tests/unit/modules/scheduled-tasks/cleanup-attachments.scheduler.spec.ts
```

Expected: FAIL，`hasActiveOrPending` 和 scheduler 尚不存在。

- [ ] **Step 2: 实现记录查询、service 委托和 scheduler**

在 `JobRecordService` 引入 `In` 和 `JOB_STATUS`，实现 `hasActiveOrPending()`。

在 `JobService` 增加：

```ts
hasActiveOrPending(name: string): Promise<boolean> {
  return this.records.hasActiveOrPending(name);
}
```

在 `ScheduledTasksModule` 注册 `CleanupAttachmentsScheduler`。

- [ ] **Step 3: 运行任务测试**

Run:

```bash
yarn workspace @my-first-nest/server test tests/unit/shared/jobs/services/job.service.spec.ts
yarn workspace @my-first-nest/server test tests/unit/modules/scheduled-tasks/cleanup-attachments.scheduler.spec.ts
yarn workspace @my-first-nest/server type-check
```

Expected: PASS。

---

### Task 5: 前端任务中心手动触发

**Files:**

- Modify: `apps/web/src/services/types/job.ts`
- Modify: `apps/web/src/services/api/background-tasks.ts`
- Modify: `apps/web/src/components/jobs/job-trigger-panel/index.tsx`
- Modify: `apps/web/src/pages/jobs/index.tsx`

**Interfaces:**

- Consumes: `newHttp`、现有 `JobTriggerPanel` 的 `loading` 和提交回调模式。
- Produces:

```ts
export const JOB_NAMES = {
  // existing jobs
  CLEANUP_ATTACHMENTS: 'cleanup-attachments',
} as const;

export const SubmitCleanupAttachments = async () => {
  const response = await http.post<IJobRun>(
    '/background-tasks/cleanup-attachments',
  );
  return response.data;
};
```

`JobTriggerPanel` 新增 prop：

```ts
interface IJobTriggerPanelProps {
  loading?: boolean;
  onSubmitExportReport: (data: ISubmitExportReportDto) => void;
  onSubmitFlakyRetry: (data: ISubmitFlakyRetryDto) => void;
  onSubmitCleanup: () => void;
  onSubmitCleanupAttachments: () => void;
}
```

按钮：

```tsx
<Button
  icon={<ClearOutlined />}
  loading={loading}
  onClick={onSubmitCleanupAttachments}
  block
>
  清理附件
</Button>
```

`Jobs` 页面继续复用现有 `handleJobSubmitted`：

```ts
const cleanupAttachmentsMutation = useMutation({
  mutationFn: SubmitCleanupAttachments,
  onSuccess: handleJobSubmitted,
  onError: (error: Error) =>
    message.error(error.message || '提交失败'),
});

const triggerLoading =
  exportReportMutation.isPending ||
  flakyRetryMutation.isPending ||
  cleanupMutation.isPending ||
  cleanupAttachmentsMutation.isPending;
```

`JobTriggerPanel` 调用：

```tsx
onSubmitCleanupAttachments={() =>
  cleanupAttachmentsMutation.mutate()
}
```

- [ ] **Step 1: 修改前端 job 类型和 API**

保持现有常量风格，命名统一为 `CLEANUP_ATTACHMENTS` 和 `SubmitCleanupAttachments`。

- [ ] **Step 2: 接入任务触发面板**

在现有任务触发面板中增加“清理附件”按钮，不创建新的页面或 Card。

- [ ] **Step 3: 验证前端**

Run:

```bash
yarn workspace @my-first-nest/web type-check
yarn workspace @my-first-nest/web build
```

Expected: PASS。

---

### Task 6: 文档和最终验证

**Files:**

- Modify: `apps/server/src/modules/attachments/README.md`
- Modify: `apps/server/src/shared/jobs/README.md`
- Modify: `apps/docs/src/notes/attachments.md`

**Interfaces:**

- Consumes: 最终配置、服务、job 和接口。
- Produces: 清理任务的使用说明、候选筛选说明、配置说明和已知边界。

README 必须写清：

- 两类清理对象的筛选条件。
- `ATTACHMENT_CLEANUP_RETENTION_DAYS` 默认 7，最小 1。
- `ATTACHMENT_CLEANUP_BATCH_SIZE` 默认 100，范围 1-1000。
- 文件不存在计为成功并硬删除元数据。
- 单条失败会保留元数据并在下次重试。
- 自动触发每天 03:00，手动入口为 `POST /api/background-tasks/cleanup-attachments`。
- 已有同名 queued / delayed / active 任务时，自动触发跳过。
- 清理任务不提供回收站和人工恢复。

Jobs README 增加：

```md
## 附件物理清理

- 每天 03:00 自动提交 `cleanup-attachments`
- 手动接口：`POST /api/background-tasks/cleanup-attachments`
- 候选：超过保留期的软删除附件、从未绑定的孤儿附件
- 结果：`deletedMetadataCount`、`missingFileCount`、`failedCount`、`scannedCount`、`reachedSafetyLimit`
```

- [ ] **Step 1: 更新文档**

只写最终行为和约束，不记录实现过程或被否方案。

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

按 Spec 第 10.3 节执行：

1. 软删除一个附件并调整保留期，触发清理，确认物理文件被删除。
2. 创建一个超过保留期的未绑定附件，触发清理，确认文件和元数据均被删除。
3. 删除物理文件但不删除元数据，确认返回结果包含 `missingFileCount`，且元数据被硬删除。
4. 模拟单条文件删除失败，确认失败项保留且其他候选继续处理。
5. 在任务中心确认自动和手动清理任务均出现执行记录。
6. 在已有同名 queued / delayed / active 任务时触发自动任务，确认不会新增重复 `job_runs`。

---

## Self-Review

### Spec Coverage

- 软删除附件清理：Task 2。
- 从未绑定孤儿清理：Task 2。
- 物理删除后硬删除元数据：Task 2。
- 文件不存在视为成功：Task 1、Task 2。
- 单条失败隔离和下次重试：Task 2。
- 批量循环和安全上限：Task 2。
- 配置默认值和范围校验：Task 1。
- 候选查询索引：Task 1。
- Worker handler 和结果记录：Task 3。
- 手动触发接口：Task 3、Task 5。
- 每天 03:00 自动触发：Task 4。
- 同名任务重复抑制：Task 4。
- 前端任务中心入口：Task 5。
- 测试和文档：Task 1 至 Task 6。

### Type Consistency

- Job 名称统一为 `JOB_NAMES.CLEANUP_ATTACHMENTS`，字符串为 `cleanup-attachments`。
- 清理结果统一使用 `ICleanupAttachmentsResult`。
- 存储删除契约统一为 `remove(key): Promise<boolean>`。
- 自动任务成功提交前统一调用 `hasActiveOrPending()`。
- 前端 API 统一命名为 `SubmitCleanupAttachments`。

### Boundary Check

- 本计划不实现对象存储清理、回收站、人工恢复、用户配额和清理审计报表。
- 本计划不修改文档业务权限和前端文档页面。
- 清理任务失败不会回滚已成功删除的其他附件。
