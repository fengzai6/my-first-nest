# 任务系统二期设计：任务中心 + Bull Board + SSE

> 状态：已确认并实现  
> 日期：2026-07-28  
> 范围：在一期服务端任务底座之上，实现学习向完整二期  
> 前置：`docs/superpowers/specs/2026-07-14-jobs-system-design.md`

## 1. 目标

在现有 `shared/jobs` + `background-tasks` + `scheduled-tasks` 之上，补齐学习向二期：

1. 前端任务中心：列表、筛选、详情、手动触发、取消
2. Bull Board：观察 BullMQ 队列内部状态
3. SSE 任务进度推送：本期先实现服务端能力，前端暂不接入

核心学习点：

- 业务层 `job_runs` 与队列层 BullMQ 的定位差异
- 保留轮询与 SSE 两种实时刷新路径的设计；本期前端先使用轮询，SSE 通过后端接口单独验证

## 2. 共识与约束

| 项         | 结论                                                            |
| ---------- | --------------------------------------------------------------- |
| 复用一期   | 必须复用现有 JobService / JobRecordService / handlers / JWT API |
| 轮询       | 保留完整代码路径，不删除、不降级为隐藏实现                      |
| SSE        | 后端新增第二种实时方式，不替换轮询；前端暂不接入                |
| 切换       | 方案保留，前端本期不开发 Polling / SSE 切换                     |
| Bull Board | 挂载管理入口，必须鉴权，不替代任务中心                          |
| 鉴权       | 沿用全局 JWT；不做用户级任务隔离 / RBAC 细化                    |
| 不做       | 动态 cron 管理台、WebSocket 进度、新业务 handler、完整 RBAC     |

## 3. 总体架构

```text
前端任务中心 (apps/web)
  - 列表：GET /api/jobs
  - 触发：POST /api/background-tasks/*
  - 取消：POST /api/jobs/:id/cancel
  - 详情刷新模式 A：轮询 GET /api/jobs/:id
  - 后端预留刷新模式 B：SSE  GET /api/jobs/:id/events（前端暂不接）
  - 队列监控入口：打开 /admin/queues

服务端
  Controllers
    JobsController          # 列表 / 详情 / 取消 / SSE
    BackgroundTasksController
    Bull Board adapter      # /admin/queues
        |
  JobService / JobRecordService / JobProcessor
        |
  JobEventsService (新增)   # 进程内事件总线，供 SSE 订阅
        |
  +-----+-----+
  BullMQ queue/worker     PostgreSQL job_runs
```

## 4. 页面信息架构

### 4.1 路由与导航

| 路径            | 页面       | 说明                            |
| --------------- | ---------- | ------------------------------- |
| `/jobs`         | 任务中心   | 列表 + 触发面板 + 详情抽屉/面板 |
| `/admin/queues` | Bull Board | 服务端管理页，新窗口打开        |

侧边栏 `For U` 组新增：

- 名称：任务中心
- 路径：`/jobs`

说明：

- 一期没有独立详情路由；二期优先采用「列表 + 右侧/抽屉详情」单页，避免拆成半成品多页。
- 若实现中发现详情信息过重，可再拆 `/jobs/:id`，但默认推荐单页完成完整流程。

### 4.2 任务中心布局

```text
┌────────────────────────────────────────────────────────────┐
│ 任务中心                          [队列监控]               │
│ 说明：任务中心看 job_runs；Bull Board 看队列内部状态       │
├──────────────────────────┬─────────────────────────────────┤
│ 触发面板                 │ 筛选：name / status + 刷新列表  │
│ - export-report          │ 表格：id/name/status/progress/  │
│ - flaky-retry            │ triggerType/createdAt/error摘要 │
│ - cleanup-expired-...    │ 操作：查看详情 / 取消           │
├──────────────────────────┴─────────────────────────────────┤
│ 任务详情（选中后展开）                                     │
│ 刷新方式：Polling；SSE 后端能力保留，前端暂不接入          │
│ 当前轮询状态                                               │
│ progress / status / attempts / timestamps                  │
│ payload / result / errorMessage                            │
└────────────────────────────────────────────────────────────┘
```

### 4.3 组件边界（前端）

```text
apps/web/src/
├── pages/jobs/index.tsx
├── components/jobs/
│   ├── jobs-page-header/
│   ├── job-trigger-panel/
│   ├── job-filters/
│   ├── job-list-table/
│   ├── job-detail-panel/
│   ├── job-refresh-mode-toggle/
│   └── job-progress-section/
├── services/
│   ├── api/jobs.ts
│   ├── api/background-tasks.ts
│   ├── types/job.ts
│   ├── dtos/job.ts
│   └── hooks/
│       ├── use-jobs-list.ts
│       └── use-job-polling.ts
└── constants/  # 如补充 PATHS / JOB 常量
```

规则：

- 组件目录 kebab-case，命名导出
- 不做桶导出
- HTTP 复用 `new-http`
- React Query 负责列表与轮询；前端 SSE hook 暂缓实现

## 5. API 增补

### 5.1 已有 API（复用，不改语义）

| 方法   | 路径                                                   | 用途                        |
| ------ | ------------------------------------------------------ | --------------------------- |
| `GET`  | `/api/jobs`                                            | 列表分页 + name/status 筛选 |
| `GET`  | `/api/jobs/:id`                                        | 单任务详情，轮询主路径      |
| `POST` | `/api/jobs/:id/cancel`                                 | 取消 queued/delayed         |
| `POST` | `/api/background-tasks/export-report`                  | 触发导出                    |
| `POST` | `/api/background-tasks/flaky-retry`                    | 触发 flaky 重试             |
| `POST` | `/api/background-tasks/cleanup-expired-refresh-tokens` | 触发清理                    |

列表响应保持一期现有结构：

```ts
{
  list: IJobRunView[];
  total: number;
  page: number;
  pageSize: number;
}
```

### 5.2 新增 SSE API

| 方法  | 路径                   | 说明                   |
| ----- | ---------------------- | ---------------------- |
| `GET` | `/api/jobs/:id/events` | 订阅单个任务进度事件流 |

约束：

- 需要 JWT（非 Public）
- 先校验任务存在，不存在 404
- 连接后立即推送一次当前快照（`job.snapshot`）
- 后续仅推送该 `jobId` 的变更
- 终态 `completed` / `failed` / `cancelled` 推送后关闭流
- 前端可断线重连；若已终态，重连后收到 snapshot 后立即结束

### 5.3 Bull Board

| 方法     | 路径            | 说明                 |
| -------- | --------------- | -------------------- |
| `GET` 等 | `/admin/queues` | Bull Board UI 与 API |

约束：

- 不走 `/api` 前缀
- 必须鉴权
- 至少暴露 default 队列 waiting/active/completed/failed

## 6. 轮询与 SSE 并存设计（SSE 前端暂缓）

### 6.1 模式定义

```ts
export const JOB_REFRESH_MODE = {
  POLLING: "polling",
  SSE: "sse",
} as const;

export type JobRefreshMode =
  (typeof JOB_REFRESH_MODE)[keyof typeof JOB_REFRESH_MODE];
```

### 6.2 行为规则

| 模式    | 行为                                                           | 停止条件                           |
| ------- | -------------------------------------------------------------- | ---------------------------------- |
| Polling | `useQuery(GetJobById)` + `refetchInterval`（建议 1500–2000ms） | 终态、关闭详情 |
| SSE     | 本期只实现后端 `/api/jobs/:id/events`，前端暂不建立连接        | 后端终态后结束流 |

后续前端接入时的切换规则：

1. 切换前先 teardown 旧模式（取消 interval / 关闭流）
2. 切换后立即拉一次当前快照或建立新连接
3. 两种模式互斥运行，避免双通道同时写状态
4. 列表页本身可用手动刷新或低频 invalidate；详情实时刷新只由当前模式负责

### 6.3 前端 hooks

`use-job-polling.ts`

- 输入：`jobId`、`enabled`
- 输出：job 数据、loading、error、isFetching
- 终态时 `refetchInterval = false`

`use-job-sse.ts`

- 本期暂不实现
- 输入：`jobId`、`enabled`
- 输出：job 数据、connectionStatus、lastEventAt、error
- 终态后关闭连接
- 断线后有限次重连（学习示例即可，如指数退避到上限）

`job-detail-panel` 本期只启用 `use-job-polling`；`use-job-sse` 作为后续接入点保留在方案中。

### 6.4 学习对比文案（页面内固定展示）

| 方式 | 优点               | 缺点             | 适用     |
| ---- | ------------------ | ---------------- | -------- |
| 轮询 | 实现简单、兼容性好 | 有延迟、多余请求 | 通用默认 |
| SSE  | 实时、服务端推送   | 连接管理更复杂   | 进度场景 |

页面可先保留说明：SSE 是后端已预留的第二种实现示例，前端暂不接入；轮询不被替代。

## 7. SSE 事件协议

### 7.1 传输

- Content-Type: `text/event-stream`
- 每条事件：

```text
event: <eventName>
id: <monotonic-or-timestamp>
data: <json>

```

### 7.2 事件名

```ts
export const JOB_SSE_EVENT = {
  SNAPSHOT: "job.snapshot",
  UPDATED: "job.updated",
  COMPLETED: "job.completed",
  FAILED: "job.failed",
  CANCELLED: "job.cancelled",
} as const;
```

说明：

- 统一用少量事件，避免过度细分
- progress/status 变化都走 `job.updated`
- 终态使用对应终态事件，payload 为完整任务快照

### 7.3 data payload

所有 SSE 事件的 `data` 都是完整 `IJobRunView` 快照，不是部分字段补丁。前端应按整份任务对象替换缓存，不要做字段合并。

```ts
export interface IJobRunView {
  id: string;
  name: string;
  queueName: string;
  status: JobStatus;
  progress: number;
  payload?: unknown;
  result?: unknown;
  errorMessage?: string | null;
  attemptsMade: number;
  maxAttempts: number;
  triggerType: JobTriggerType;
  startedAt?: Date | string | null;
  finishedAt?: Date | string | null;
  createdAt: Date | string;
}
```

示例：

```text
event: job.snapshot
id: 1
data: {"id":"123","name":"export-report","status":"active","progress":40,"errorMessage":null,"result":null,"attemptsMade":1,"maxAttempts":1,"triggerType":"manual","startedAt":"...","finishedAt":null,"createdAt":"..."}

event: job.updated
id: 2
data: {"id":"123","name":"export-report","queueName":"default","status":"active","progress":80,"payload":{"title":"report"},"result":null,"errorMessage":null,"attemptsMade":1,"maxAttempts":1,"triggerType":"manual","startedAt":"...","finishedAt":null,"createdAt":"..."}

event: job.completed
id: 3
data: {"id":"123","status":"completed","progress":100,"result":{"file":"mock.pdf"},...}
```

### 7.4 服务端事件源

新增 `JobEventsService`（进程内 EventEmitter / RxJS Subject）：

发布点：

- `JobRecordService.updateProgress`
- `JobRecordService.markActive` 成功后
- `JobRecordService.markCompleted`
- `JobRecordService.markAttemptFailure`（含最终 failed 与中间 queued）
- `JobRecordService.markCancelledIfCancellable` 成功后

SSE controller 流程：

1. 写 SSE headers
2. 先订阅 `JobEventsService`，按 jobId 过滤
3. 再读取并发送 snapshot
4. 终态后 complete + `res.end()`
5. req close 时取消订阅

必须先订阅再读 snapshot，避免快照读取期间发布的事件丢失。

说明：

- 一期单实例学习场景足够；不引入 Redis pub/sub
- 多实例广播不在本期范围

### 7.5 鉴权注意

浏览器原生 `EventSource` 不能自定义 `Authorization` header。

后续前端接入推荐实现：

- 前端用 `fetch` + `ReadableStream` 读 SSE，并带上 JWT
- 复用现有 token 获取方式

不推荐把 accessToken 塞进 query string 作为主方案。

## 8. Bull Board 挂载与鉴权

### 8.1 挂载路径

- UI：`/admin/queues`
- 不挂在 `/api` 下
- Vite 开发代理需增加 `/admin` 转发到后端当前开发端口
- 本仓库当前本地约定：server `3174`，web `4174`。项目默认值仍可能是 `8080` / `5173`；端口被占用时以实际启动输出为准

### 8.2 集成方式

优先官方适配：

- `@bull-board/api`
- `@bull-board/express`
- `@bull-board/nestjs`（若与当前 Nest 11 / BullMQ 兼容则优先）

独立模块建议：

```text
apps/server/src/shared/jobs/board/
  job-board.module.ts
  job-board.auth.middleware.ts
```

不把 Board 路由塞进 `JobsController`。

### 8.3 鉴权

- 必须鉴权，不能裸奔

### 8.4 定位文案

README / 页面固定说明：

| 视图       | 看什么                                        | 不看什么                     |
| ---------- | --------------------------------------------- | ---------------------------- |
| 任务中心   | 业务层 `job_runs`：进度、结果、错误、触发类型 | BullMQ 内部 waiting 列表细节 |
| Bull Board | 队列内部 waiting/active/completed/failed      | 业务 payload/result 语义     |

## 9. 服务端模块边界

### 9.1 修改点

| 模块               | 改动                                            |
| ------------------ | ----------------------------------------------- |
| `shared/jobs`      | 新增 SSE endpoint、JobEventsService、Board 模块 |
| `JobRecordService` | 状态变更后发布事件                              |
| `JobsController`   | 新增 `GET :id/events`                           |
| `background-tasks` | 原则上不改；前端直接复用现有提交 API            |
| `scheduled-tasks`  | 不改                                            |

### 9.2 路由顺序

`JobsController` 中使用：

- `GET /jobs`
- `GET /jobs/:id/events` → `@Get(':id/events')`
- `GET /jobs/:id`
- `POST /jobs/:id/cancel`

### 9.3 依赖

服务端预计新增：

- `@bull-board/api`
- `@bull-board/express`
- 以及兼容的 Nest 适配包（若选用）

前端本期不实现 SSE；后续接入时用原生 fetch stream 即可。

## 10. 前端实现要点

### 10.1 鉴权

- 页面挂在 `AuthGuard` 下
- 未登录跳转登录
- REST 请求继续走 `new-http` 自动带 JWT
- SSE 前端接入暂缓

### 10.2 列表

- React Query：`["jobs", { page, pageSize, name, status }]`
- 表格列：id、name、status、progress、triggerType、createdAt、error 摘要
- 可取消状态显示取消按钮

### 10.3 触发面板

三个动作：

1. export-report：可填 title/steps/stepDelayMs
2. flaky-retry：可填 failTimes
3. cleanup-expired-refresh-tokens：无 body

提交成功后：

- toast 成功
- invalidate 列表
- 自动选中新 job 并进入详情

### 10.4 详情

展示：

- status / progress
- payload / result / errorMessage
- attemptsMade / maxAttempts
- startedAt / finishedAt / createdAt
- 轮询刷新状态 + SSE 暂缓接入说明

## 11. 文档改动

| 文档                    | 内容                            |
| ----------------------- | ------------------------------- |
| `shared/jobs/README.md` | 补充 SSE、Board、与任务中心边界 |
| 根 README 或 roadmap    | 标记二期完成项                  |
| 本设计文档              | 作为二期 spec                   |
| 页面内文案              | 轮询 vs SSE；任务中心 vs Board  |

对比表必须出现在文档中：

### 轮询 vs SSE

| 方式 | 优点               | 缺点             | 适用     |
| ---- | ------------------ | ---------------- | -------- |
| 轮询 | 实现简单、兼容性好 | 有延迟、多余请求 | 通用默认 |
| SSE  | 实时、服务端推送   | 连接管理更复杂   | 进度场景 |

### 任务中心 vs Bull Board

| 视图       | 数据源       | 用途                   |
| ---------- | ------------ | ---------------------- |
| 任务中心   | `job_runs`   | 业务任务生命周期与结果 |
| Bull Board | BullMQ queue | 队列可观测性学习       |

## 12. 明确不做

- 动态 cron 管理台
- 完整用户级任务隔离 / RBAC 细化
- cats 成长等新业务 handler
- 用 WebSocket 替代 SSE
- 用 Bull Board 替代任务中心
- 删除或隐藏轮询实现
- 多实例 SSE 广播（Redis pub/sub）

## 13. 验收标准

1. 登录后可进入任务中心完整流程
2. 可触发 3 类后台任务并看到结果
3. 同一任务详情支持：
   - 仅轮询刷新
   - 后端 SSE 可通过接口单独验证
4. 轮询终态停止；SSE 后端终态后结束流
5. Bull Board 可访问且受保护
6. 文档能讲清：
   - 任务中心 vs Bull Board
   - 轮询 vs SSE
7. 代码风格匹配现有 monorepo
8. 本地可运行并给出测试步骤

## 14. 建议实现顺序

1. 服务端：JobEventsService + 记录变更发事件
2. 服务端：SSE `GET /jobs/:id/events`
3. 服务端：Bull Board 模块 + 鉴权 + vite proxy
4. 前端：jobs API/types + 列表/触发/取消
5. 前端：详情 + polling hook
6. 文档与手动验收
7. 提交独立分支 `feat/jobs-phase2-learning-console`

## 15. 本地验证提纲（实现后执行）

1. 登录 web
2. 打开任务中心，触发 export-report，用 Polling 看到 progress → completed
3. 用 curl 或浏览器开发工具验证 `/api/jobs/:id/events` 可收到 snapshot / updated / terminal 事件并结束流
4. 触发 flaky-retry，观察重试与最终状态
5. 触发 cleanup-expired-refresh-tokens，观察完成
6. 对 queued/delayed 任务执行取消
7. 打开队列监控，确认需鉴权且能看到 default 队列
8. 未登录访问 `/jobs` 应跳转登录；未带 token 访问 Board/SSE 应 401

## 16. 待确认后执行

用户确认本设计后：

1. 产出实现计划（writing-plans）
2. 在独立分支编码
3. 手动验证 + 必要测试
4. 按需开 PR
