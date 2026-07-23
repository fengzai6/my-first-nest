# 任务 / 定时任务系统设计

> 状态：已确认并完成一期服务端实现  
> 日期：2026-07-14  
> 范围：一期仅服务端；二期再做前端

## 1. 目标

为学习型 NestJS 项目提供一套清晰、可扩展的任务能力：

1. 用 `@nestjs/schedule` 演示轻量进程内定时任务
2. 用 BullMQ + PostgreSQL 实现完整任务系统：
   - 定时 / 延迟调度
   - 接口触发的异步任务
   - 进度与状态查询
   - 失败重试
   - 执行记录落库
3. 模块边界足够优雅，业务接入路径短且统一

## 2. 共识与约束

| 项 | 结论 |
|----|------|
| 分期 | 一期服务端，二期前端 |
| 双底座 | `@nestjs/schedule` 轻量示例 + BullMQ 完整任务能力 |
| 任务定义 | 代码注册 handler，不设动态任务定义表 |
| 能力范围 | 定时 + 手动/接口异步任务 + 状态轮询 |
| 状态存储 | BullMQ 负责执行；PostgreSQL 存执行记录 |
| 示例 | schedule 心跳 + `export-report` + `flaky-retry` |
| 模块化 | 基础设施与业务示例分离 |
| Redis | BullMQ 使用独立 `ioredis` 连接，复用现有 Redis 配置，不混用 `REDIS_CLIENT` |
| 鉴权 | 一期演示接口可用 `@Public()`，预留 `createdBy` |

## 3. 架构

### 3.1 分层

```text
Controllers / Demo APIs
  - 提交异步任务、查询状态、触发失败重试示例
        |
Job Application Layer
  - JobService：提交 / 取消 / 查询
  - JobRegistry：按 name 找 handler
  - JobRecordService：读写 PostgreSQL 记录
        |
   +----+----+
BullMQ Queue/Worker     PostgreSQL job_runs

另：ScheduleDemoModule（@nestjs/schedule）
仅作轻量对比示例，不进入 Job 主链路
```

### 3.2 目录结构

```text
apps/server/src/
├── shared/
│   └── jobs/
│       ├── jobs.module.ts
│       ├── constants/job.constants.ts
│       ├── types/job.types.ts
│       ├── registry/
│       │   ├── job-handler.interface.ts
│       │   └── job-registry.service.ts
│       ├── queue/
│       │   ├── job-queue.module.ts
│       │   ├── job-queue.service.ts
│       │   └── job.processor.ts
│       ├── records/
│       │   ├── entities/job-run.entity.ts
│       │   └── job-record.service.ts
│       ├── services/job.service.ts
│       ├── dto/
│       ├── jobs.controller.ts             # 通用查询 / 取消
│       └── README.md
│
├── modules/
│   ├── schedule-demo/
│   │   ├── schedule-demo.module.ts
│   │   ├── heartbeat.scheduler.ts
│   │   └── README.md
│   └── demo-jobs/
│       ├── demo-jobs.module.ts
│       ├── demo-jobs.controller.ts
│       ├── handlers/
│       │   ├── export-report.handler.ts
│       │   └── flaky-retry.handler.ts
│       ├── dto/
│       └── README.md
```

### 3.3 模块职责

| 模块 | 职责 | 不做什么 |
|------|------|----------|
| `shared/jobs` | 队列、注册、执行编排、落库、通用任务 API | 不写具体业务逻辑 |
| `modules/demo-jobs` | 示例 handler + 演示提交 API | 不实现底层队列 |
| `modules/schedule-demo` | 轻量 cron 对比 | 不接入 BullMQ / 不写 `job_runs` |

### 3.4 Handler 发现方式

Handler 在构造函数中自注册到 `JobRegistryService`：

- 业务模块把 handler 放入 `providers`
- handler 构造时调用 `registry.register(this)`
- `name` 全局唯一，重复注册直接失败

理由：注册时机早于 Worker 消费，类型直观，避免 multi provider 与模块边界的隐式收集问题。

### 3.5 扩展方式

新增业务任务只需：

1. 新增 handler 并实现 `IJobHandler`
2. 构造函数中 `registry.register(this)`，并加入业务模块 `providers`
3. 调用 `JobService.submit({ name, payload, ... })`

不修改统一 Processor 主流程。

## 4. 数据模型

### 4.1 状态

```ts
export const JOB_STATUS = {
  QUEUED: 'queued',
  ACTIVE: 'active',
  COMPLETED: 'completed',
  FAILED: 'failed',
  DELAYED: 'delayed',
  CANCELLED: 'cancelled',
} as const;

export type JobStatus = (typeof JOB_STATUS)[keyof typeof JOB_STATUS];
```

状态机：

```text
enqueue → queued / delayed
worker 取到 → active
成功 → completed
最终失败 → failed
queued/delayed 取消 → cancelled
active 期间失败且仍可重试 → 由 BullMQ 重新调度，attemptsMade + 1
```

终态：`completed` / `failed` / `cancelled`

### 4.2 表 `job_runs`

继承项目 `BaseEntity`（雪花 ID、时间戳、软删）。

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | bigint PK | 对外 `jobId` |
| `name` | varchar | handler 名 |
| `queueName` | varchar | 默认 `default` |
| `bullJobId` | varchar, nullable | BullMQ 内部 id |
| `triggerType` | varchar | `manual` \| `cron` \| `system` |
| `status` | varchar | 状态 |
| `progress` | int, default 0 | 0–100 |
| `payload` | jsonb, nullable | 提交参数 |
| `result` | jsonb, nullable | 成功结果摘要 |
| `errorMessage` | text, nullable | 失败摘要 |
| `attemptsMade` | int, default 0 | 已尝试次数 |
| `maxAttempts` | int, default 1 | 最大尝试次数 |
| `startedAt` | timestamptz, nullable | 首次 active |
| `finishedAt` | timestamptz, nullable | 终态时间 |
| `createdBy` | bigint, nullable | 提交用户，一期可空 |

索引：

- `(status, createdAt DESC)`
- `(name, createdAt DESC)`
- `bullJobId`

### 4.3 一期不做的表

- `job_definitions`
- `job_schedules` 管理表
- `job_run_events` 流水表

说明：任务类型由代码注册；调度示例可用代码侧 `upsertJobScheduler`；事件流水后续按需再加。

## 5. 接口设计

### 5.1 Handler 契约

```ts
export interface IJobContext<TPayload = unknown> {
  jobId: string;
  bullJobId?: string;
  name: string;
  payload: TPayload;
  attemptsMade: number;
  maxAttempts: number;
  updateProgress: (progress: number) => Promise<void>;
}

export interface IJobHandler<TPayload = unknown, TResult = unknown> {
  readonly name: string;
  handle(ctx: IJobContext<TPayload>): Promise<TResult>;
}
```

约束：

- `name` 全局唯一
- handler 只写业务，不直接依赖 Queue / Entity
- 抛错表示本次 attempt 失败

### 5.2 JobService

```ts
submit(input: {
  name: string;
  payload?: unknown;
  delayMs?: number;
  attempts?: number;
  backoffMs?: number;
  triggerType?: 'manual' | 'cron' | 'system';
  createdBy?: string;
}): Promise<JobRunView>

getById(jobId: string): Promise<JobRunView>

list(query: {
  name?: string;
  status?: JobStatus;
  page?: number;
  pageSize?: number;
}): Promise<{ items: JobRunView[]; total: number }>

cancel(jobId: string): Promise<JobRunView>
```

`JobRunView` 字段：

- `id`
- `name`
- `status`
- `progress`
- `payload?`
- `result?`
- `errorMessage?`
- `attemptsMade`
- `maxAttempts`
- `triggerType`
- `startedAt?`
- `finishedAt?`
- `createdAt`

### 5.3 HTTP API

#### 通用任务 API（`JobsController`）

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/jobs` | 分页列表，支持 `name` / `status` |
| `GET` | `/jobs/:id` | 查询单任务，供轮询 |
| `POST` | `/jobs/:id/cancel` | 取消 `queued` / `delayed` |

#### 示例提交 API（`DemoJobsController`）

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/demo-jobs/export-report` | 异步导出，返回 jobId |
| `POST` | `/demo-jobs/flaky-retry` | 失败重试示例 |

`export-report` body：

```json
{
  "title": "monthly-report",
  "steps": 5,
  "stepDelayMs": 500
}
```

`flaky-retry` body：

```json
{
  "failTimes": 2
}
```

一期演示接口使用 `@Public()`，方便 Swagger / 学习调用。

### 5.4 Processor 编排

```text
JobProcessor.process(bullJob)
  1. 读取 job.data 中的 jobId / name / payload
  2. record.markActive(jobId, bullJobId)
  3. handler = registry.get(name)
  4. result = await handler.handle(ctx)
  5. record.markCompleted(jobId, result)
  catch:
     更新 attemptsMade
     若最终失败：markFailed
     rethrow 给 BullMQ 决定是否重试
```

`updateProgress(n)`：

- 写 `job_runs.progress`
- 可选同步 `bullJob.updateProgress(n)`

## 6. 示例任务

### 6.1 schedule 心跳

- 位置：`modules/schedule-demo/heartbeat.scheduler.ts`
- 行为：每分钟输出心跳日志
- 目的：展示 `@nestjs/schedule` 最小用法
- 不进入 `job_runs`

### 6.2 export-report

- 名称：`export-report`
- 触发：`POST /demo-jobs/export-report`
- 行为：按 steps 推进 progress 到 100，写入 mock result
- 查询：`GET /jobs/:id`
- 默认 `attempts = 1`

### 6.3 flaky-retry

- 名称：`flaky-retry`
- 触发：`POST /demo-jobs/flaky-retry`
- 行为：前 `failTimes` 次抛错
- 队列：`attempts = 3`，`backoff` 固定或指数
- 结果：
  - 可恢复 → completed
  - 超出 attempts → failed，写 `errorMessage`

## 7. 配置与依赖

### 7.1 新增依赖

- `@nestjs/bullmq`
- `bullmq`
- `@nestjs/schedule`

### 7.2 Redis / BullMQ

- 复用现有 `REDIS_URL` 或 `REDIS_HOST/PORT/PASSWORD/DB`
- BullMQ 自建 `ioredis` 连接
- 队列 key 前缀固定为：`${REDIS_KEY_PREFIX}bull:`
- 未配置 Redis 时，Jobs 模块不得静默伪装可用；应初始化失败或明确禁用并报错

### 7.3 数据库

- 新增 `job_runs` entity
- 开发环境可依赖 `DATABASE_SYNCHRONIZE`
- 同步补 migration，保持仓库迁移习惯

## 8. schedule vs BullMQ 对比

| 维度 | `@nestjs/schedule` | BullMQ 任务系统 |
|------|--------------------|-----------------|
| 触发 | 进程内 cron | cron / 延迟 / 手动提交 |
| 多实例 | 易重复执行 | 队列消费，天然去重 |
| 重试 | 需自管 | 内置 attempts / backoff |
| 进度与结果 | 无统一模型 | `job_runs` + API |
| 适用 | 轻量本地逻辑 | 异步任务与任务中心 |
| 本项目位置 | `schedule-demo` | `shared/jobs` + `demo-jobs` |

文档落点：

- `shared/jobs/README.md`
- `modules/demo-jobs/README.md`
- `modules/schedule-demo/README.md`

## 9. 错误处理与边界

| 场景 | 行为 |
|------|------|
| 未知 handler name | submit 时 400 |
| job 不存在 | GET 404 |
| 取消 active 任务 | 一期拒绝（409 或业务错误） |
| payload 过大 | DTO 校验；不存巨型 blob |
| handler 抛错 | attempt 失败；最终失败写摘要 |
| Redis 不可用 | 任务系统不可用，明确失败 |

日志字段至少包含：`jobId`、`name`、`bullJobId`、`attemptsMade`。

## 10. 一期不做

- 前端页面
- Bull Board
- 动态任务定义 / 在线改 cron 管理台
- 任务事件流水表
- 用户级权限隔离（只预留 `createdBy`）
- WebSocket / SSE 推送进度
- schedule 多实例分布式锁增强

## 11. 成功标准

1. 服务启动后可见 schedule 心跳日志
2. 可提交 `export-report`，通过 `GET /jobs/:id` 观察进度直至 completed
3. 可提交 `flaky-retry`，观察到重试与最终 completed / failed 落库
4. 新业务接入路径稳定：handler → provider → `JobService.submit`
5. 文档能清楚解释 schedule 与 BullMQ 边界

## 12. 二期预留

- 前端任务中心（列表、详情、进度、手动触发）
- Bull Board 或自建监控页
- 登录用户绑定 `createdBy` 与权限码
- 可选 SSE/WebSocket 进度推送
- 真实业务任务（如 cats 成长、缓存清理）迁入 handler

## 13. 实现顺序建议

1. 接入依赖与 BullMQ / schedule 模块骨架
2. 实现 `job_runs`、JobRecordService、JobRegistry、JobService、Processor
3. 实现通用 `/jobs` API
4. 实现 demo handlers 与提交 API
5. 实现 schedule-demo 心跳
6. 补 README / roadmap 说明
7. 按需补 migration 与测试（测试范围实现前再确认）
