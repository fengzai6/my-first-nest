# 日志系统 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 NestJS 服务提供异步持久化、Seq 双通道同步、受特殊角色保护的日志查询 API，以及 React 日志查看页面。

**Architecture:** 日志入口在请求上下文、HTTP 拦截器、异常过滤器和业务模块中生成统一 `ILogEvent`。`LoggerService` 立即输出 CLEF JSON 到 stdout，并将日志缓冲为 BullMQ 批处理任务；`LogProcessor` 以幂等写入 PostgreSQL 后投递 Seq `/ingest/clef`。日志查询和保留清理由共享 `LogModule` 提供，前端通过受保护的 REST API 展示分页列表和详情。

**Tech Stack:** NestJS 11、TypeORM 0.3、PostgreSQL、BullMQ、Redis、Node.js 内置 `fetch`、class-validator、Swagger、React 19、React Router 7、TanStack Query、Ant Design 6、Tailwind CSS、Vitest、Docker Compose、Seq CLEF HTTP ingestion。

**Spec:** `docs/superpowers/specs/2026-09-10-logging-system-design.md`

## Global Constraints

- 不新增 npm 依赖；Seq HTTP 调用使用 Node.js 20.19+ 内置 `fetch`。
- 新增 TypeScript 代码不使用 `any`；常量对象使用 `as const`，不新增 `enum`。
- 不记录 HTTP `body`、`headers` 或 `query`；日志上下文只允许约定字段和调用方显式传入的非敏感数据。
- 日志写入不阻塞请求路径；`LoggerService` 不等待 Redis、PostgreSQL 或 Seq 响应。
- `log_records` 不使用软删除；保留策略通过定时任务物理删除到期记录。
- Seq 批量接口必须使用 `POST {SEQ_URL}/ingest/clef`、换行分隔 CLEF JSON、`Content-Type: application/vnd.serilog.clef`，有 API Key 时使用 `X-Seq-ApiKey`。
- 日志查询 API 必须由 `SpecialRolesGuard` 保护，允许 `developer` 和 `super_admin`；前端隐藏菜单不是安全边界。
- 前端优先复用 Ant Design、TanStack Query、项目 `new-http` 和现有侧边栏组件；不新增 UI 测试依赖。
- 未经用户明确要求，不执行 `git commit`、`git push`、创建分支或 PR；每个任务验证完成后保留工作区变更。

---

## File Structure

```text
apps/server/
├── database/migrations/
│   └── 20260910xxxxxx-create-log-records.ts          # log_records 表和索引
├── src/
│   ├── app.module.ts                                  # 在业务模块前导入 LogModule
│   ├── common/
│   │   ├── context/request-context.ts                 # requestId 和请求元数据 ALS
│   │   ├── middleware/request-context.middleware.ts   # 每个 HTTP 请求初始化上下文
│   │   ├── middleware/index.ts                         # 注册 request-context middleware
│   │   ├── interceptors/index.ts                       # 注入 LoggerService，调整上下文顺序
│   │   ├── interceptors/logging.interceptor.ts         # 成功 HTTP 请求摘要日志
│   │   ├── interceptors/user-context.interceptor.ts    # 将认证用户同步进请求上下文
│   │   ├── filters/index.ts                            # 注入 LoggerService
│   │   ├── filters/global-exception.filter.ts          # 失败 HTTP 请求错误日志
│   │   ├── filters/ws-exception.filter.ts              # WebSocket 异常日志
│   │   └── exceptions/
│   │       ├── log.exception.ts                        # LOG_NOT_FOUND 错误映射
│   │       └── error.exception.ts                      # 汇入日志错误码
│   ├── config/
│   │   ├── configuration.interface.ts                  # LogConfig / SeqConfig
│   │   ├── config.default.ts                            # 日志和 Seq 默认配置
│   │   └── env.validation.ts                            # LOG_* / SEQ_* 校验
│   ├── modules/
│   │   ├── scheduled-tasks/
│   │   │   ├── scheduled-tasks.module.ts               # 注入 LogModule
│   │   │   └── cleanup-expired-logs.scheduler.ts        # 每日清理过期日志
│   │   └── socket/
│   │       ├── socket.module.ts                         # 注册 WsExceptionFilter
│   │       ├── socket.gateway.ts                        # Socket 事件结构化日志
│   │       └── socket.service.ts                        # 连接/断开结构化日志
│   └── shared/
│       ├── jobs/queue/{job-queue.service.ts,job.processor.ts}
│       │                                                  # 任务队列事件接入 LoggerService
│       └── log/
│           ├── constants/log.constants.ts               # 日志级别、类别和队列名
│           ├── dto/query-log.dto.ts                     # API 查询 DTO
│           ├── entities/log-record.entity.ts            # 不可变日志实体
│           ├── interfaces/log.interface.ts              # ILogEvent、查询和队列契约
│           ├── log.module.ts                            # 全局日志模块
│           ├── log.service.ts                           # 幂等保存、查询、详情、清理
│           ├── logger.service.ts                        # stdout + 异步队列日志入口
│           ├── log-queue.service.ts                    # 50 条/5 秒聚合入队
│           ├── log.processor.ts                         # PostgreSQL + Seq 批处理消费者
│           ├── clef.ts                                  # 共享的 CLEF 映射和序列化
│           ├── seq-transport.service.ts                 # CLEF HTTP 发送器
│           └── log.controller.ts                        # developer/super_admin 查询 API
└── tests/
    ├── unit/common/{filters,interceptors,middleware}/  # 请求和异常采集测试
    ├── unit/shared/log/                                # 日志核心单元测试
    └── e2e/logs.e2e-spec.ts                            # 特殊角色、查询、详情 E2E

apps/web/src/
├── components/app-sidebar/index.tsx                    # 条件显示日志菜单
├── components/logs/
│   ├── log-detail-drawer/index.tsx                     # JSON/stack 详情 Drawer
│   ├── log-filters/index.tsx                           # 时间、级别、类别和关键字筛选
│   ├── log-level-tag/index.tsx                         # 日志级别标签
│   └── log-table/index.tsx                             # 固定列宽的分页表格
├── pages/logs/index.tsx                                # 查询状态和页面组装
├── router/routes.tsx                                   # /logs 路由
└── services/
    ├── api/logs.ts                                     # GetLogs / GetLog
    ├── dtos/log.ts                                     # 查询参数
    ├── hooks/use-logs-list.ts                          # React Query 列表查询
    └── types/log.ts                                    # API 日志模型和常量

docker/
├── docker-compose.seq.yml                              # Seq 容器、卷和外部网络
├── docker-compose.app.yml                              # 配置 app 对 Seq 的 HTTP Push
└── docker-compose.local.yml                            # 配置本地镜像对 Seq 的 HTTP Push

apps/server/.env.example                                # 记录 LOG_* / SEQ_* 环境变量
README.md                                               # 增加 Seq 启动与访问说明
```

### Task 1: 日志契约、配置、实体和数据库迁移

**Files:**

- Create: `apps/server/src/shared/log/constants/log.constants.ts`
- Create: `apps/server/src/shared/log/interfaces/log.interface.ts`
- Create: `apps/server/src/shared/log/entities/log-record.entity.ts`
- Create: `apps/server/src/common/context/request-context.ts`
- Create: `apps/server/database/migrations/20260910xxxxxx-create-log-records.ts`
- Modify: `apps/server/src/config/configuration.interface.ts`
- Modify: `apps/server/src/config/config.default.ts`
- Modify: `apps/server/src/config/env.validation.ts`
- Test: `apps/server/tests/unit/shared/log/log-contract.spec.ts`

**Interfaces:**

- Produces `LOG_LEVEL` and `LogLevel`, with exactly `debug`、`info`、`warn`、`error`、`fatal`.
- Produces `LOG_CATEGORY` for `HTTP`、`AUTH`、`SOCKET`、`JOB`、`SCHEDULED_TASK`、`BUSINESS`，业务调用仍可传入其他字符串类别。
- Produces `ILogEvent`、`ILogWriteOptions`、`ILogPage`、`IQueryLogs` 和 `ILogBatchJobData`。
- Produces `requestContextStorage: AsyncLocalStorage<IRequestContext>`，上下文字段为 `requestId`、`startedAt`、`method`、`url`、`ip`、可选 `userId`。
- Produces `LogRecord` 和 `log_records` 表；后续任务只通过 `ILogEvent` 在内存与队列中传递日志。

- [x] **Step 1: 写失败的日志契约测试**

创建 `tests/unit/shared/log/log-contract.spec.ts`，直接验证常量和请求上下文可被同一异步链读取：

```ts
import { LOG_CATEGORY, LOG_LEVEL } from "@/shared/log/constants/log.constants";
import {
  requestContextStorage,
  type IRequestContext,
} from "@/common/context/request-context";
import { describe, expect, it } from "vitest";

describe("logging contracts", () => {
  it("defines the supported levels and base categories", () => {
    expect(Object.values(LOG_LEVEL)).toEqual([
      "debug",
      "info",
      "warn",
      "error",
      "fatal",
    ]);
    expect(LOG_CATEGORY.HTTP).toBe("HTTP");
    expect(LOG_CATEGORY.SOCKET).toBe("Socket");
  });

  it("keeps request metadata in the current async context", async () => {
    const context: IRequestContext = {
      requestId: "request-1",
      startedAt: 123,
      method: "GET",
      url: "/api/logs",
      ip: "127.0.0.1",
      userId: "user-1",
    };

    await requestContextStorage.run(context, async () => {
      await Promise.resolve();
      expect(requestContextStorage.getStore()).toEqual(context);
    });
  });
});
```

- [x] **Step 2: 运行测试确认 RED**

Run: `cd apps/server && yarn test tests/unit/shared/log/log-contract.spec.ts`

Expected: FAIL，模块 `@/shared/log/constants/log.constants` 和 `@/common/context/request-context` 尚不存在。

- [x] **Step 3: 定义常量、接口和请求上下文**

在 `log.constants.ts` 中使用常量对象：

```ts
export const LOG_LEVEL = {
  DEBUG: "debug",
  INFO: "info",
  WARN: "warn",
  ERROR: "error",
  FATAL: "fatal",
} as const;

export type LogLevel = (typeof LOG_LEVEL)[keyof typeof LOG_LEVEL];

export const LOG_CATEGORY = {
  HTTP: "HTTP",
  AUTH: "Auth",
  SOCKET: "Socket",
  JOB: "Job",
  SCHEDULED_TASK: "ScheduledTask",
  BUSINESS: "Business",
} as const;

export const LOG_QUEUE = {
  NAME: "log-queue",
  JOB_NAME: "persist-log-batch",
} as const;
```

在 `log.interface.ts` 中令 `context` 为 `Record<string, unknown> | null`，令每个可空数据库字段为 `string | null` 或 `number | null`；`ILogEvent.timestamp` 使用 `Date`，`ILogPage.items` 使用 `ILogEvent[]`。`IRequestContext` 放在 `request-context.ts`，并导出唯一 `AsyncLocalStorage<IRequestContext>` 实例。

- [x] **Step 4: 扩展配置与环境变量校验**

在 `configuration.interface.ts` 添加：

```ts
export interface SeqConfig {
  enabled: boolean;
  url?: string;
  apiKey?: string;
  timeoutMs: number;
}

export interface LogConfig {
  retentionDays: number;
  batchSize: number;
  flushIntervalMs: number;
  seq: SeqConfig;
}
```

并在 `AppConfig` 增加 `log?: LogConfig`。在 `defaultConfig` 增加默认值 `30`、`50`、`5000`、`false` 和 `5000`。在 Joi schema 添加以下约束：

```ts
LOG_RETENTION_DAYS: Joi.number().integer().min(1).default(30),
LOG_BATCH_SIZE: Joi.number().integer().min(1).max(500).default(50),
LOG_FLUSH_INTERVAL_MS: Joi.number().integer().min(100).default(5000),
SEQ_ENABLED: Joi.boolean().default(false),
SEQ_URL: Joi.when('SEQ_ENABLED', {
  is: true,
  then: Joi.string().uri().required(),
  otherwise: Joi.string().uri().optional(),
}),
SEQ_API_KEY: Joi.string().allow(''),
SEQ_TIMEOUT_MS: Joi.number().integer().min(100).default(5000),
```

`SEQ_ENABLED=true` 且无 `SEQ_URL` 时必须在应用启动阶段失败；未启用时不要求配置 Seq。

- [x] **Step 5: 实现不可变 `LogRecord` 实体与手写迁移**

不要继承带 `updatedAt`、`deletedAt` 的 `BaseEntity`。`LogRecord` 使用 `@Entity('log_records')`、`@PrimaryColumn({ type: 'bigint' }) id: string` 和：

```ts
@Index("IDX_log_records_timestamp", ["timestamp"])
@Index("IDX_log_records_level_timestamp", ["level", "timestamp"])
@Index("IDX_log_records_category_timestamp", ["category", "timestamp"])
@Index("IDX_log_records_user_id_timestamp", ["userId", "timestamp"])
@Index("IDX_log_records_request_id", ["requestId"])
export class LogRecord {
  @PrimaryColumn({ type: "bigint" }) id: string;
  @Column({ type: "varchar", length: 16 }) level: LogLevel;
  @Column({ type: "varchar", length: 64 }) category: string;
  @Column({ type: "text" }) message: string;
  @Column({ type: "jsonb", nullable: true }) context: Record<
    string,
    unknown
  > | null;
  @Column({ type: "varchar", length: 64, nullable: true }) requestId:
    | string
    | null;
  @Column({ type: "bigint", nullable: true }) userId: string | null;
  @Column({ type: "varchar", length: 45, nullable: true }) ip: string | null;
  @Column({ type: "varchar", length: 10, nullable: true }) method:
    | string
    | null;
  @Column({ type: "text", nullable: true }) url: string | null;
  @Column({ type: "smallint", nullable: true }) statusCode: number | null;
  @Column({ type: "integer", nullable: true }) duration: number | null;
  @Column({ type: "text", nullable: true }) stack: string | null;
  @Column({ type: "timestamptz", default: () => "CURRENT_TIMESTAMP" })
  timestamp: Date;
}
```

创建迁移时使用精确表名 `log_records` 与上述五个索引。`down()` 先删除索引，再删除表。迁移文件名使用实际生成时间替代计划中的 `xxxxxx`，但类名固定为 `CreateLogRecords<timestamp>`。

- [x] **Step 6: 运行单元测试、类型检查和迁移验证**

Run: `cd apps/server && yarn test tests/unit/shared/log/log-contract.spec.ts`

Expected: PASS。

Run: `cd apps/server && yarn type-check`

Expected: PASS。

在专用开发数据库执行：`DATABASE_URL=<日志测试库连接串> yarn db:migrate`，随后执行：

```sql
SELECT indexname
FROM pg_indexes
WHERE tablename = 'log_records'
ORDER BY indexname;
```

Expected: 主键和五个约定索引都存在。

- [x] **Step 7: 保留未提交变更**

Run: `git status --short`

Expected: 只出现本任务创建或修改的日志契约、配置、实体和迁移文件；不执行 `git commit`。

### Task 2: 异步队列、CLEF stdout 和 Seq HTTP 投递

**Files:**

- Create: `apps/server/src/shared/log/log-queue.service.ts`
- Create: `apps/server/src/shared/log/logger.service.ts`
- Create: `apps/server/src/shared/log/clef.ts`
- Create: `apps/server/src/shared/log/seq-transport.service.ts`
- Create: `apps/server/src/shared/log/log.processor.ts`
- Create: `apps/server/src/shared/log/log.service.ts`
- Create: `apps/server/src/shared/log/log.module.ts`
- Modify: `apps/server/src/app.module.ts`
- Test: `apps/server/tests/unit/shared/log/logger.service.spec.ts`
- Test: `apps/server/tests/unit/shared/log/seq-transport.service.spec.ts`
- Test: `apps/server/tests/unit/shared/log/log.processor.spec.ts`

**Interfaces:**

- Produces `LoggerService.log(message, options?)`、`warn(message, options?)`、`error(message, error?, options?)` 和 `debug(message, options?)`，它们全部返回 `void`。
- Produces `LogQueueService.enqueue(event: ILogEvent): void` 和 `flush(): Promise<void>`。
- Produces `SeqTransportService.send(events: readonly ILogEvent[]): Promise<void>`。
- Produces `toClefLogEvent(event: ILogEvent): Record<string, unknown>`；stdout 和 Seq HTTP 必须复用这一映射。
- Produces `LogService.insertIgnoreConflicts(events: readonly ILogEvent[]): Promise<void>`；同一 `id` 重试不得生成第二行记录。

- [x] **Step 1: 写 LoggerService 与 SeqTransport 的失败测试**

在 `logger.service.spec.ts` mock `LogQueueService.enqueue` 和 `process.stdout.write`，验证请求上下文会自动合并且入队不被等待：

```ts
it("writes CLEF JSON and queues an enriched event without awaiting I/O", () => {
  const queue = { enqueue: vi.fn() };
  const logger = new LoggerService(queue as never);
  const write = vi.spyOn(process.stdout, "write").mockReturnValue(true);

  requestContextStorage.run(
    {
      requestId: "request-1",
      startedAt: 0,
      method: "GET",
      url: "/api/cats",
      ip: "127.0.0.1",
      userId: "user-1",
    },
    () => logger.log("request completed", { category: LOG_CATEGORY.HTTP })
  );

  expect(queue.enqueue).toHaveBeenCalledWith(
    expect.objectContaining({
      level: LOG_LEVEL.INFO,
      requestId: "request-1",
      userId: "user-1",
      method: "GET",
      url: "/api/cats",
    })
  );
  expect(String(write.mock.calls[0]?.[0])).toContain(
    '"@m":"request completed"'
  );
  expect(String(write.mock.calls[0]?.[0])).toContain('"requestId":"request-1"');
});
```

在 `seq-transport.service.spec.ts` 用 `vi.stubGlobal('fetch', fetchMock)` 验证：

```ts
await transport.send([event]);

expect(fetchMock).toHaveBeenCalledWith(
  "http://seq:5341/ingest/clef",
  expect.objectContaining({
    method: "POST",
    headers: expect.objectContaining({
      "Content-Type": "application/vnd.serilog.clef",
      "X-Seq-ApiKey": "seq-key",
    }),
    body: expect.stringContaining('"@t"'),
  })
);
```

再添加 `503` 会 reject、未启用 Seq 不调用 `fetch`、多条事件由单个 `\n` 分隔请求体组成的断言。

- [x] **Step 2: 运行测试确认 RED**

Run: `cd apps/server && yarn test tests/unit/shared/log/logger.service.spec.ts tests/unit/shared/log/seq-transport.service.spec.ts tests/unit/shared/log/log.processor.spec.ts`

Expected: FAIL，日志服务、队列服务、Seq transport 和 processor 尚不存在。

- [x] **Step 3: 实现 `LoggerService` 和 CLEF 序列化**

`LoggerService` 在构建事件时调用现有 `generateSnowflakeId()`，从 `requestContextStorage.getStore()` 获取默认请求字段，再用调用参数覆盖。实现内部私有方法：

```ts
private write(level: LogLevel, message: string, options: ILogWriteOptions = {}): void
```

该方法必须：

1. 创建完整 `ILogEvent`，未提供字段填 `null`。
2. 调用 `process.stdout.write(`${JSON.stringify(this.toClef(event))}\n`)`。
3. 调用 `this.queue.enqueue(event)`，不 `await` 且不让入队异常影响业务请求。

在 `clef.ts` 导出 `toClefLogEvent()`，它只产生顶层 CLEF 字段 `@t`、`@l`、`@m`、可选 `@x`，其余属性使用普通字段名 `logId`、`requestId`、`userId`、`category`、`method`、`url`、`statusCode`、`duration`、`ip`、`context`。不要把应用日志 ID 写进 `@i`，因为 Seq 将 `@i` 解释为事件类型而不是唯一事件 ID。`LoggerService` 使用 `JSON.stringify(toClefLogEvent(event))` 写 stdout。

`error()` 遇到 `Error` 时写入 `error.stack ?? error.message`；遇到非 Error 通过安全字符串化生成 message 或 stack，禁止抛出序列化异常。

- [x] **Step 4: 实现聚合入队、幂等写入和 Seq transport**

`LogQueueService` 实现 `OnModuleDestroy`。它缓冲 `ILogEvent[]`，到达 `log.batchSize` 立刻 flush；未满时用唯一 `setTimeout()` 在 `log.flushIntervalMs` 后 flush；销毁时清除 timer 并 `await flush()`。用 `isFlushing` 保证任何时刻只有一次 `queue.add()`。一个 Bull 作业包含：

```ts
export interface ILogBatchJobData {
  events: ILogEvent[];
}
```

`flush()` 通过 `queue.add(LOG_QUEUE.JOB_NAME, { events }, { attempts: 3, backoff: { type: 'fixed', delay: 1000 }, removeOnComplete: { count: 1000 }, removeOnFail: { count: 5000 } })` 发送一批。`queue.add()` 失败时将这一批放回缓冲区并重新安排下一次 interval flush；错误只写 `process.stderr`，不得再次调用 `LoggerService`。

`LogService.insertIgnoreConflicts()` 使用：

```ts
await this.repository
  .createQueryBuilder()
  .insert()
  .into(LogRecord)
  .values(events)
  .orIgnore()
  .execute();
```

`SeqTransportService` 从 `getConfig(configService).log.seq` 读取配置。启用时向 `${url.replace(/\/$/, '')}/ingest/clef` 发出一次 `fetch`，body 为 `events.map(toClefLogEvent).map(JSON.stringify).join('\n')`。使用 `AbortSignal.timeout(timeoutMs)`，仅 `201` 视为成功；其他响应读取至多 500 字符的文本后抛出 `Error`。

`LogProcessor` 使用 `@Processor(LOG_QUEUE.NAME)`，严格按下面顺序处理：

```ts
await this.logs.insertIgnoreConflicts(job.data.events);
await this.seqTransport.send(job.data.events);
```

Seq 失败必须抛出，让 BullMQ 进行 3 次重试；数据库 `orIgnore()` 保证 retry 不重复写 PostgreSQL。该路径是至少一次投递，Seq 在 worker 确认前故障重试时允许出现重复事件。

- [x] **Step 5: 组装全局 `LogModule`**

创建：

```ts
@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([LogRecord]),
    JobQueueModule,
    BullModule.registerQueue({ name: LOG_QUEUE.NAME }),
  ],
  controllers: [],
  providers: [
    LogService,
    LoggerService,
    LogQueueService,
    LogProcessor,
    SeqTransportService,
    SpecialRolesGuard,
  ],
  exports: [LogService, LoggerService],
})
export class LogModule {}
```

在 `AppModule.imports` 中将 `LogModule` 放在 `...modules` 之前，使 Socket、任务和定时模块可通过全局模块注入 `LoggerService`。`JobQueueModule` 保证 BullMQ root 配置在日志队列注册前可用。

- [x] **Step 6: 完善 processor 测试并运行 GREEN**

在 `log.processor.spec.ts` 覆盖以下顺序：

```ts
await processor.process({ data: { events: [event] } } as Job<ILogBatchJobData>);

expect(logService.insertIgnoreConflicts).toHaveBeenCalledWith([event]);
expect(seqTransport.send).toHaveBeenCalledWith([event]);
expect(
  logService.insertIgnoreConflicts.mock.invocationCallOrder[0]
).toBeLessThan(seqTransport.send.mock.invocationCallOrder[0]);
```

再断言 `seqTransport.send` reject 时 `processor.process()` reject，保证 BullMQ 接收失败信号。

Run: `cd apps/server && yarn test tests/unit/shared/log/logger.service.spec.ts tests/unit/shared/log/seq-transport.service.spec.ts tests/unit/shared/log/log.processor.spec.ts`

Expected: PASS。

- [x] **Step 7: 类型检查并保留未提交变更**

Run: `cd apps/server && yarn type-check`

Expected: PASS。

Run: `git status --short`

Expected: 包含 Task 1 与 Task 2 的日志模块变更；不执行 `git commit`。

### Task 3: HTTP 请求上下文、请求日志和异常日志接入

**Files:**

- Create: `apps/server/src/common/middleware/request-context.middleware.ts`
- Delete: `apps/server/src/common/middleware/logger.middleware.ts`
- Modify: `apps/server/src/common/middleware/index.ts`
- Modify: `apps/server/src/common/interceptors/index.ts`
- Modify: `apps/server/src/common/interceptors/user-context.interceptor.ts`
- Modify: `apps/server/src/common/interceptors/logging.interceptor.ts`
- Modify: `apps/server/src/common/filters/index.ts`
- Modify: `apps/server/src/common/filters/global-exception.filter.ts`
- Modify: `apps/server/src/common/filters/ws-exception.filter.ts`
- Modify: `apps/server/src/modules/socket/socket.module.ts`
- Test: `apps/server/tests/unit/common/middleware/request-context.middleware.spec.ts`
- Delete: `apps/server/tests/unit/common/middleware/logger.middleware.spec.ts`
- Test: `apps/server/tests/unit/common/interceptors/logging.interceptor.spec.ts`
- Modify Test: `apps/server/tests/unit/common/interceptors/user-context.interceptor.spec.ts`
- Modify Test: `apps/server/tests/unit/common/filters/global-exception.filter.spec.ts`
- Modify Test: `apps/server/tests/unit/common/filters/ws-exception.filter.spec.ts`

**Interfaces:**

- Produces `requestContextMiddleware(req, res, next): void`，在 Guard 前创建 requestId。
- `GlobalExceptionsFilter` 和 `WsExceptionFilter` 改为构造注入 `LoggerService`。
- `LoggingInterceptor` 改为构造注入 `LoggerService`，仅记录成功 HTTP 响应；异常由全局异常过滤器记录，避免单请求两条错误日志。

- [x] **Step 1: 写失败的 request-context middleware 测试**

```ts
it("creates one request context before calling next", () => {
  const next = vi.fn(() => {
    const context = requestContextStorage.getStore();
    expect(context).toMatchObject({
      method: "GET",
      url: "/api/logs?level=error",
      ip: "127.0.0.1",
      startedAt: expect.any(Number),
    });
    expect(context?.requestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    );
  });

  requestContextMiddleware(
    {
      method: "GET",
      originalUrl: "/api/logs?level=error",
      ip: "127.0.0.1",
    } as Request,
    {} as Response,
    next
  );

  expect(next).toHaveBeenCalledOnce();
});
```

在 `logging.interceptor.spec.ts` 创建 `LoggerService` mock，使 handler 返回 `of({ ok: true })`，随后断言：

```ts
expect(logger.log).toHaveBeenCalledWith(
  "HTTP request completed",
  expect.objectContaining({
    category: LOG_CATEGORY.HTTP,
    method: "GET",
    url: "/api/cats",
    statusCode: 200,
    duration: expect.any(Number),
  })
);
```

- [x] **Step 2: 运行测试确认 RED**

Run: `cd apps/server && yarn test tests/unit/common/middleware/request-context.middleware.spec.ts tests/unit/common/interceptors/logging.interceptor.spec.ts`

Expected: FAIL，因为 request context middleware 与新构造函数尚不存在。

- [x] **Step 3: 实现上下文传播并调整 interceptor 注册顺序**

`requestContextMiddleware` 使用 `randomUUID()` 创建：

```ts
requestContextStorage.run(
  {
    requestId: randomUUID(),
    startedAt: Date.now(),
    method: req.method,
    url: req.originalUrl ?? req.url,
    ip: req.ip,
  },
  next
);
```

在 `useMiddleware()` 中于 `cookieParser()` 后注册该 middleware。删除未启用且会记录完整 `body`、`headers` 的旧 `logger.middleware.ts` 和其测试，防止未来误启用敏感数据输出。

保留已有 `userContextStorage` 行为。在 `UserContextInterceptor.intercept()` 中先读取 `requestContextStorage.getStore()`，存在时将 `context.userId = request.user?.id`，然后继续：

```ts
return userContextStorage.run(request.user, () => next.handle());
```

在 `useInterceptors(app)` 中取得 `const logger = app.get(LoggerService)`，将全局顺序改为：

```ts
new UserContextInterceptor(),
new LoggingInterceptor(logger),
new PostResponseInterceptor(),
new ClassSerializerInterceptor(app.get(Reflector)),
new TimeoutInterceptor(app),
```

这样认证用户先进入 ALS，成功 HTTP 摘要日志才能带 `userId`。

- [x] **Step 4: 接入 HTTP 和异常日志，保持既有响应格式**

`LoggingInterceptor` 记录 `Date.now()`，在 `tap({ next: ... })` 内调用：

```ts
this.logger.log("HTTP request completed", {
  category: LOG_CATEGORY.HTTP,
  method: request.method,
  url: request.originalUrl ?? request.url,
  ip: request.ip,
  statusCode: response.statusCode,
  duration: Date.now() - startedAt,
});
```

不要使用 `tap()` 的 `error` 回调记录错误。`GlobalExceptionsFilter.catch()` 在现有 response body 计算完毕后，读取 request context，并调用：

```ts
this.logger.error("HTTP request failed", exception, {
  category: LOG_CATEGORY.HTTP,
  method: request.method,
  url: request.originalUrl ?? request.url,
  ip: request.ip,
  statusCode: responseBody.statusCode,
  duration: context ? Date.now() - context.startedAt : null,
  context: { code: responseBody.code },
});
```

该 filter 仍用当前逻辑发送 `response.status(...).json(responseBody)`。在 `useFilters(app)` 中以 `new GlobalExceptionsFilter(app.get(LoggerService))` 注册。

`WsExceptionFilter` 记录 `LOG_CATEGORY.SOCKET`、client id 与 `WsException` 内容；在 `SocketModule.providers` 增加该 filter，允许 Nest 注入 `LoggerService`。

- [x] **Step 5: 更新现有异常与用户上下文测试**

将 `GlobalExceptionsFilter` 测试中的初始化替换为：

```ts
const logger = { error: vi.fn() };
const filter = new GlobalExceptionsFilter(logger as never);
```

并在未知 `Error('boom')` 用例中断言：

```ts
expect(logger.error).toHaveBeenCalledWith(
  "HTTP request failed",
  expect.any(Error),
  expect.objectContaining({ category: LOG_CATEGORY.HTTP, statusCode: 500 })
);
```

为 `UserContextInterceptor` 原有测试增加 `requestContextStorage.run()` 外层，并断言 `requestContextStorage.getStore()?.userId === 'user-id'`。更新 WebSocket filter 测试，断言它调用 `logger.warn('WebSocket exception', expect.objectContaining({ category: LOG_CATEGORY.SOCKET }))` 并仍发出 `exception` socket event。

- [x] **Step 6: 运行 GREEN 和服务端类型检查**

Run: `cd apps/server && yarn test tests/unit/common/middleware/request-context.middleware.spec.ts tests/unit/common/interceptors/logging.interceptor.spec.ts tests/unit/common/interceptors/user-context.interceptor.spec.ts tests/unit/common/filters/global-exception.filter.spec.ts tests/unit/common/filters/ws-exception.filter.spec.ts`

Expected: PASS，成功请求只写一条 HTTP info 日志，异常路径由 filter 写 error 日志，原始 HTTP/WS 响应断言保持通过。

Run: `cd apps/server && yarn type-check`

Expected: PASS。

- [x] **Step 7: 保留未提交变更**

Run: `git diff --check`

Expected: 无空白错误；不执行 `git commit`。

### Task 4: 业务来源接入和日志保留任务

**Files:**

- Modify: `apps/server/src/modules/socket/socket.gateway.ts`
- Modify: `apps/server/src/modules/socket/socket.service.ts`
- Modify: `apps/server/src/shared/jobs/queue/job-queue.service.ts`
- Modify: `apps/server/src/shared/jobs/queue/job.processor.ts`
- Create: `apps/server/src/modules/scheduled-tasks/cleanup-expired-logs.scheduler.ts`
- Modify: `apps/server/src/modules/scheduled-tasks/scheduled-tasks.module.ts`
- Modify: `apps/server/src/modules/scheduled-tasks/heartbeat.scheduler.ts`
- Modify: `apps/server/src/modules/scheduled-tasks/cleanup-expired-refresh-tokens.scheduler.ts`
- Modify Test: `apps/server/tests/unit/modules/socket/socket.gateway.spec.ts`
- Modify Test: `apps/server/tests/unit/modules/socket/socket.service.spec.ts`
- Modify Test: `apps/server/tests/unit/shared/jobs/queue/job.processor.spec.ts`
- Create Test: `apps/server/tests/unit/modules/scheduled-tasks/cleanup-expired-logs.scheduler.spec.ts`

**Interfaces:**

- Produces `LogService.purgeBefore(timestamp: Date): Promise<number>`，返回删除记录数量。
- `CleanupExpiredLogsScheduler.handleCleanup()` 每日 02:00 删除早于 `retentionDays` 的记录。
- Socket、Job、ScheduledTask 使用 `LoggerService` 作为结构化日志入口。

- [x] **Step 1: 写日志清理任务的失败测试**

```ts
it("deletes records older than the configured retention boundary", async () => {
  const logs = { purgeBefore: vi.fn().mockResolvedValue(12) };
  const scheduler = new CleanupExpiredLogsScheduler(
    logs as never,
    configServiceWithRetentionDays(30),
    logger as never
  );

  await scheduler.handleCleanup(new Date("2026-09-10T02:00:00.000Z"));

  expect(logs.purgeBefore).toHaveBeenCalledWith(
    new Date("2026-08-11T02:00:00.000Z")
  );
  expect(logger.log).toHaveBeenCalledWith(
    "Expired logs removed",
    expect.objectContaining({ category: LOG_CATEGORY.SCHEDULED_TASK })
  );
});
```

`handleCleanup(now = new Date())` 的可选参数只用于测试；`@Cron` 正常调用时不传参数。

- [x] **Step 2: 运行测试确认 RED**

Run: `cd apps/server && yarn test tests/unit/modules/scheduled-tasks/cleanup-expired-logs.scheduler.spec.ts`

Expected: FAIL，因为 scheduler 与 `LogService.purgeBefore()` 尚不存在。

- [x] **Step 3: 实现保留删除和定时任务**

在 `LogService` 添加：

```ts
async purgeBefore(timestamp: Date): Promise<number> {
  const result = await this.repository
    .createQueryBuilder()
    .delete()
    .from(LogRecord)
    .where('timestamp < :timestamp', { timestamp })
    .execute();

  return result.affected ?? 0;
}
```

`CleanupExpiredLogsScheduler` 注入 `LogService`、`ConfigService` 和 `LoggerService`，使用 `getConfig(configService).log.retentionDays` 计算边界，声明 `@Cron(CronExpression.EVERY_DAY_AT_2AM)`，并写 `LOG_CATEGORY.SCHEDULED_TASK` 日志。`ScheduledTasksModule.imports` 增加 `LogModule`，providers 增加此 scheduler。

- [x] **Step 4: 将关键业务来源切到 `LoggerService`**

在 Socket gateway/service、Job queue/service、Job processor、Heartbeat scheduler、refresh-token cleanup scheduler 中：

1. 用构造注入的 `LoggerService` 替换私有 Nest `Logger`。
2. 保留已有消息中能定位事件的 ID、用户名、任务名，但改为结构化字段，例如：

```ts
this.logger.log("Socket client connected", {
  category: LOG_CATEGORY.SOCKET,
  context: { socketId: client.id, username: user.username },
});

this.logger.error("Job processing failed", error, {
  category: LOG_CATEGORY.JOB,
  context: { jobId, name, attemptsMade, maxAttempts },
});
```

3. 只记录连接、断开、房间加入/离开、任务入队、任务开始/完成/失败、定时任务触发；不要将 Socket 消息正文或 Job payload 直接写日志。

`LoggerService` 为全局模块导出，不得在这些业务模块重复注册 provider。

- [x] **Step 5: 更新受影响单元测试**

各构造函数测试在创建 gateway/service/processor/scheduler 时注入：

```ts
const logger = {
  log: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};
```

保留既有连接、任务状态和异常行为断言，新增每个关键路径的结构化类别断言。例如 Job processor 失败路径：

```ts
expect(logger.error).toHaveBeenCalledWith(
  "Job processing failed",
  error,
  expect.objectContaining({ category: LOG_CATEGORY.JOB })
);
```

- [x] **Step 6: 运行 GREEN、类型检查和保留未提交变更**

Run: `cd apps/server && yarn test tests/unit/modules/socket/socket.gateway.spec.ts tests/unit/modules/socket/socket.service.spec.ts tests/unit/shared/jobs/queue/job.processor.spec.ts tests/unit/modules/scheduled-tasks/cleanup-expired-logs.scheduler.spec.ts`

Expected: PASS。

Run: `cd apps/server && yarn type-check && git diff --check`

Expected: 两项均 PASS；不执行 `git commit`。

### Task 5: 日志查询 API、特殊角色鉴权和服务端查询逻辑

**Files:**

- Create: `apps/server/src/shared/log/dto/query-log.dto.ts`
- Create: `apps/server/src/shared/log/log.controller.ts`
- Create: `apps/server/src/common/exceptions/log.exception.ts`
- Modify: `apps/server/src/common/exceptions/error.exception.ts`
- Modify: `apps/server/src/shared/log/log.service.ts`
- Modify: `apps/server/src/shared/log/log.module.ts`
- Test: `apps/server/tests/unit/shared/log/log.service.spec.ts`
- Test: `apps/server/tests/unit/shared/log/log.controller.spec.ts`
- Test: `apps/server/tests/e2e/logs.e2e-spec.ts`

**Interfaces:**

- Produces `GET /api/logs` 和 `GET /api/logs/:id`。
- Produces `QueryLogDto`：`page`、`pageSize`、`level`、`category`、`userId`、`requestId`、`startTime`、`endTime`、`keyword`。
- Produces `LogService.list(query: IQueryLogs): Promise<ILogPage>` 和 `LogService.getById(id: string): Promise<ILogEvent>`。
- Produces `LOG_NOT_FOUND: '16401'`，详情缺失时响应 HTTP 404。

- [x] **Step 1: 写查询服务和 controller 的失败测试**

`log.service.spec.ts` 用 query-builder mock 断言 keyword、时间边界和分页：

```ts
await service.list({
  page: 2,
  pageSize: 20,
  level: LOG_LEVEL.ERROR,
  requestId: "request-1",
  startTime: new Date("2026-09-01T00:00:00.000Z"),
  endTime: new Date("2026-09-02T00:00:00.000Z"),
  keyword: "token",
});

expect(queryBuilder.andWhere).toHaveBeenCalledWith(
  "log.message ILIKE :keyword",
  { keyword: "%token%" }
);
expect(queryBuilder.skip).toHaveBeenCalledWith(20);
expect(queryBuilder.take).toHaveBeenCalledWith(20);
```

`log.controller.spec.ts` 只需验证委托和 Swagger 无关行为：

```ts
await expect(controller.getById("missing")).rejects.toMatchObject({
  code: ErrorExceptionCode.LOG_NOT_FOUND,
});
```

E2E 测试直接经 repository 插入一条 `LogRecord`，将测试用户的 `specialRoles` 更新为 `[SpecialRolesEnum.Developer]`，断言 GET list 和 detail 返回 200；无 `developer/super_admin` 的 token 返回 403。

- [x] **Step 2: 运行测试确认 RED**

Run: `cd apps/server && yarn test tests/unit/shared/log/log.service.spec.ts tests/unit/shared/log/log.controller.spec.ts`

Expected: FAIL，因为 DTO、controller、查询方法和日志错误码尚不存在。

- [x] **Step 3: 实现 DTO、错误码和查询服务**

`QueryLogDto` 使用以下验证：

```ts
@IsOptional() @IsIn(Object.values(LOG_LEVEL)) level?: LogLevel;
@IsOptional() @IsString() @MaxLength(64) category?: string;
@IsOptional() @IsString() @MaxLength(64) userId?: string;
@IsOptional() @IsString() @MaxLength(64) requestId?: string;
@IsOptional() @IsDateString() startTime?: string;
@IsOptional() @IsDateString() endTime?: string;
@IsOptional() @IsString() @MaxLength(200) keyword?: string;
@IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
@IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize = 20;
```

`LogService.list()` 从 DTO 转换 ISO date，并构建 `createQueryBuilder('log')`。只有调用方传入值时才添加 `andWhere()`；时间使用 `log.timestamp >= :startTime` 与 `log.timestamp <= :endTime`，关键词只匹配 `log.message ILIKE :keyword`。最后固定 `orderBy('log.timestamp', 'DESC')`、`skip((page - 1) * pageSize)`、`take(pageSize)`、`getManyAndCount()`，返回 `{ items, total, page, pageSize }`。

新建 `log.exception.ts`，内容与 `job.exception.ts` 同样使用 `ExceptionInfo`，并在 `ErrorExceptionCode`、`ErrorExceptionMap` 中汇入。`getById()` 找不到实体时抛 `new ErrorException(ErrorExceptionCode.LOG_NOT_FOUND)`。

- [x] **Step 4: 实现受特殊角色保护的 controller**

```ts
@ApiTags("Logs - 日志")
@ApiBearerAuth()
@Controller("logs")
@UseGuards(SpecialRolesGuard)
@SpecialRoles([SpecialRolesEnum.Developer, SpecialRolesEnum.SuperAdmin])
export class LogController {
  constructor(private readonly logs: LogService) {}

  @Get()
  list(@Query() query: QueryLogDto) {
    return this.logs.list(query);
  }

  @Get(":id")
  getById(@Param("id") id: string) {
    return this.logs.getById(id);
  }
}
```

`LogModule` 已提供 `SpecialRolesGuard`；不要新增 `log:query` 权限，也不要改动普通 RBAC 权限常量或 seed。

此任务将 `LogController` 加入 `LogModule.controllers`，替换 Task 2 的空数组。

- [x] **Step 5: 运行 unit 和 E2E 测试**

Run: `cd apps/server && yarn test tests/unit/shared/log/log.service.spec.ts tests/unit/shared/log/log.controller.spec.ts`

Expected: PASS。

Run: `cd apps/server && yarn test:e2e tests/e2e/logs.e2e-spec.ts`

Expected: PASS，前提是 `DATABASE_URL` 和 `REDIS_URL` 指向可用的集成测试实例。

- [x] **Step 6: 服务端全量验证并保留未提交变更**

Run: `cd apps/server && yarn test && yarn type-check && yarn lint`

Expected: PASS。

Run: `git status --short`

Expected: 仅工作区变更；不执行 `git commit`。

### Task 6: React 日志服务层、路由、侧边栏和查看页面

**Files:**

- Create: `apps/web/src/services/types/log.ts`
- Create: `apps/web/src/services/dtos/log.ts`
- Create: `apps/web/src/services/api/logs.ts`
- Create: `apps/web/src/services/hooks/use-logs-list.ts`
- Create: `apps/web/src/components/logs/log-level-tag/index.tsx`
- Create: `apps/web/src/components/logs/log-filters/index.tsx`
- Create: `apps/web/src/components/logs/log-table/index.tsx`
- Create: `apps/web/src/components/logs/log-detail-drawer/index.tsx`
- Create: `apps/web/src/pages/logs/index.tsx`
- Modify: `apps/web/src/router/routes.tsx`
- Modify: `apps/web/src/components/app-sidebar/index.tsx`

**Interfaces:**

- Produces `GetLogs(params: IFindLogsQuery): Promise<ILogsPage>` 与 `GetLog(id: string): Promise<ILogRecord>`。
- Produces `useLogsList(query)`，query key 必须包含全部筛选项和分页项。
- Produces `/logs` 路由；页面从服务端分页，不在浏览器累计或筛选全量日志。

- [x] **Step 1: 定义前端日志类型与 API 函数**

在 `types/log.ts` 定义与服务端保持同值的：

```ts
export const LOG_LEVEL = {
  DEBUG: "debug",
  INFO: "info",
  WARN: "warn",
  ERROR: "error",
  FATAL: "fatal",
} as const;

export type LogLevel = (typeof LOG_LEVEL)[keyof typeof LOG_LEVEL];

export interface ILogRecord {
  id: string;
  level: LogLevel;
  category: string;
  message: string;
  context: Record<string, unknown> | null;
  requestId: string | null;
  userId: string | null;
  ip: string | null;
  method: string | null;
  url: string | null;
  statusCode: number | null;
  duration: number | null;
  stack: string | null;
  timestamp: string;
}

export interface ILogsPage {
  items: ILogRecord[];
  total: number;
  page: number;
  pageSize: number;
}
```

在 `api/logs.ts` 使用项目客户端：

```ts
export const GetLogs = async (params: IFindLogsQuery) => {
  const res = await http.get<ILogsPage>("/logs", { params });
  return res.data;
};

export const GetLog = async (id: string) => {
  const res = await http.get<ILogRecord>(`/logs/${id}`);
  return res.data;
};
```

`useLogsList()` 使用：

```ts
export const LOGS_LIST_QUERY_KEY = ["logs", "list"] as const;

return useQuery({
  queryKey: [...LOGS_LIST_QUERY_KEY, query],
  queryFn: () => GetLogs(query),
  placeholderData: (previous) => previous,
});
```

- [x] **Step 2: 实现筛选控件与日志表格**

`LogFilters` 使用 Ant Design `DatePicker.RangePicker`（`showTime`）、`Select`、`Input`、`Button`。父组件仅保存 ISO 字符串：`onChange={(dates) => onTimeRangeChange(dates?.[0]?.toISOString(), dates?.[1]?.toISOString())}`，不要新增或直接依赖 `dayjs`。

`LogLevelTag` 用固定映射：`debug=default`、`info=blue`、`warn=gold`、`error=red`、`fatal=magenta`。`LogTable` 使用 Ant Design `Table`，设定固定宽度：时间 190、级别 88、类别 120、用户 150、HTTP 280、耗时 90、操作 56；消息列使用 `ellipsis`，详情按钮使用 `EyeOutlined` 和 `Tooltip`，不使用文字型工具按钮。

`LogDetailDrawer` 以 `Descriptions` 展示基础字段，以只读 `Typography.Paragraph` + `pre` 展示格式化 `context` 和 `stack`。格式化函数必须处理 `null`：

```ts
const formatJson = (value: unknown) =>
  value === null || value === undefined ? "-" : JSON.stringify(value, null, 2);
```

- [x] **Step 3: 组装日志页面状态与详情请求**

`pages/logs/index.tsx` 按既有组件顺序保留：state → function → request hooks → JSX。初始 `page=1`、`pageSize=20`。任一筛选项变化后执行 `setPage(1)`；详情 Drawer 打开后才以：

```ts
useQuery({
  queryKey: ["logs", "detail", selectedLogId],
  queryFn: () => GetLog(selectedLogId!),
  enabled: selectedLogId !== null,
});
```

请求失败显示 `Alert` 和带 `ReloadOutlined` 的图标按钮。页面使用普通受限布局 `div.p-6`，筛选和表格不嵌套 Card；表格宽度不足时使用 `scroll={{ x: 1250 }}`。

- [x] **Step 4: 注册路由和按特殊角色显示侧边栏菜单**

在 `routes.tsx` 导入 `Logs`，在认证后的 children 增加：

```tsx
{
  path: 'logs',
  element: <Logs />,
},
```

在侧边栏导入 `FileTextOutlined` 和 `useUserStore`。将静态 groups 拆成基础 groups 和在 `AppSidebar` 内构建的 logs item。只有：

```ts
const canViewLogs = specialRoles?.some(
  (role) => role === SpecialRoles.Developer || role === SpecialRoles.SuperAdmin
);
```

为 true 时，才加入 `{ name: '日志', icon: <FileTextOutlined />, path: '/logs' }`。后端 special-role guard 仍是唯一授权判断。

- [x] **Step 5: 运行前端验证**

Run: `cd apps/web && yarn type-check && yarn lint && yarn build`

Expected: PASS。

UI smoke check：以 `developer` 用户登录，确认左侧有“日志”菜单；切换到普通用户后菜单隐藏；直接访问 `/logs` 时服务端返回 403 并显示错误 Alert；在 developer 身份下筛选、翻页、打开详情 Drawer，确认长 JSON 和 stack 不遮挡其他字段。

- [x] **Step 6: 保留未提交变更**

Run: `git diff --check && git status --short`

Expected: 无 diff whitespace error；不执行 `git commit`。

### Task 7: Seq Docker 运行环境、环境文档和全链路验证

**Files:**

- Create: `docker/docker-compose.seq.yml`
- Modify: `docker/docker-compose.app.yml`
- Modify: `docker/docker-compose.local.yml`
- Modify: `apps/server/.env.example`
- Modify: `README.md`

**Interfaces:**

- Produces本地可启动的 `seq` Docker service，容器内 URL 为 `http://seq`，宿主机 UI 为 `http://localhost:5341`。
- Production-style app compose 启用 `SEQ_ENABLED=true` 并通过 `SEQ_URL=http://seq` 投递。

- [x] **Step 1: 创建 Seq Compose 文件**

创建 `docker/docker-compose.seq.yml`：

```yaml
name: my-first-nest

services:
  seq:
    image: datalust/seq:latest
    container_name: my-first-nest-seq
    restart: on-failure:5
    environment:
      ACCEPT_EULA: Y
    ports:
      - "5341:80"
    volumes:
      - seq-data:/data
    networks:
      - my-nest-network

networks:
  my-nest-network:
    external: true
    name: my-nest-network

volumes:
  seq-data:
```

在 app/local compose 的 app `environment` 追加：

```yaml
SEQ_ENABLED: "true"
SEQ_URL: http://seq
SEQ_TIMEOUT_MS: 5000
```

不要把 API Key 写入 compose；需要认证时由部署环境设置 `SEQ_API_KEY`。

- [x] **Step 2: 补充环境模板和 README**

在 `.env.example` 追加：

```dotenv
# Logging
# LOG_RETENTION_DAYS=30
# LOG_BATCH_SIZE=50
# LOG_FLUSH_INTERVAL_MS=5000

# Seq (set SEQ_ENABLED=true only when SEQ_URL is reachable)
# SEQ_ENABLED=false
# SEQ_URL=http://localhost:5341
# SEQ_API_KEY=
# SEQ_TIMEOUT_MS=5000
```

在 README Docker 章节增加启动顺序：创建外部 network 后，运行 `docker compose -f docker/docker-compose.seq.yml up -d`，再启动 database、Redis、app；注明 Seq UI 地址为 `http://localhost:5341`，日志 HTTP Push 使用 `http://seq/ingest/clef`。

- [x] **Step 3: 运行 Docker 和运行时全链路验证**

Run:

```bash
docker network create my-nest-network || true
docker compose -f docker/docker-compose.db.yml up -d
docker compose -f docker/docker-compose.cache.yml up -d
docker compose -f docker/docker-compose.seq.yml up -d
docker compose -f docker/docker-compose.app.yml up --build -d
```

Expected: 四个服务均运行，`docker compose -f docker/docker-compose.seq.yml ps` 显示 Seq healthy/running。

以 `developer` 身份调用一个成功 endpoint 和一个失败 endpoint，确认：

1. `GET /api/logs` 返回带 `requestId`、级别、耗时和时间戳的分页日志。
2. `GET /api/logs/:id` 返回 `context` / `stack` 的完整详情。
3. `docker logs my-first-nest-app` 中每条 LoggerService 日志是单行 JSON 且含 `@t`、`@l`、`@m`。
4. 打开 `http://localhost:5341`，确认能查询到相同 HTTP、异常、Socket/Job 或 ScheduledTask 日志。
5. 临时停止 Seq 容器，确认 HTTP 请求仍成功、PostgreSQL 仍保留日志、BullMQ 对日志批次重试；恢复 Seq 后新批次成功写入。

- [x] **Step 4: 执行最终自动化验证**

Run:

```bash
yarn workspace @my-first-nest/server test
yarn workspace @my-first-nest/server type-check
yarn workspace @my-first-nest/web test
yarn workspace @my-first-nest/web type-check
yarn workspace @my-first-nest/web build
git diff --check
git status --short
```

Expected: 所有命令 PASS，`git status --short` 仅展示本日志系统文件，且没有创建提交。

- [x] **Step 5: 停在待交付状态**

记录验证命令结果和残余风险：Seq HTTP Push 是至少一次语义，worker 在 Seq 接收成功但作业确认前故障时可能产生重复 Seq 事件；PostgreSQL 以 `id` 冲突忽略确保不重复落库。等待用户明确决定是否提交。

## Plan Self-Review

| Spec requirement                                | Plan coverage |
| ----------------------------------------------- | ------------- |
| HTTP、异常、Socket、Job、定时任务与手动业务日志 | Tasks 2、3、4 |
| PostgreSQL 实体、索引、迁移和 30 天清理         | Tasks 1、4    |
| 非阻塞批量写入与失败重试                        | Task 2        |
| Seq stdout 与 HTTP CLEF 双通道                  | Tasks 2、7    |
| `developer` / `super_admin` 查询授权            | Task 5        |
| 分页、筛选、详情 API                            | Task 5        |
| 前端路由、侧边栏、筛选表格和详情 Drawer         | Task 6        |
| 单元、E2E、类型、构建、Docker 验证              | Tasks 1-7     |

已检查：计划没有任何占位表述；跨任务接口名称与参数在 File Structure、Interfaces 和任务步骤中一致；所有任务都以可验证结果结束，且不包含自动 Git 提交。
