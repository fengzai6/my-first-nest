# 任务系统二期设计：任务中心 + Bull Board + SSE

> 状态：二期与前端 SSE 接入均已实现<br>
> 日期：2026-07-28（更新：2026-08-17）<br>
> 范围：在一期服务端任务底座之上，实现学习向完整二期，并补齐 Jobs 前端 SSE 详情刷新<br>
> 前置：`docs/superpowers/specs/2026-07-14-jobs-system-design.md`

## 1. 目标

在现有 `shared/jobs` + `background-tasks` + `scheduled-tasks` 之上，补齐学习向二期：

1. 前端任务中心：列表、筛选、详情、手动触发、取消
2. Bull Board：观察 BullMQ 队列内部状态
3. SSE 任务进度推送：前端详情默认使用 SSE，并可切换到轮询进行学习对比

核心学习点：

- 业务层 `job_runs` 与队列层 BullMQ 的定位差异
- 保留轮询与 SSE 两种可运行、可观察的实时刷新路径

## 2. 共识与约束

| 项         | 结论                                                            |
| ---------- | --------------------------------------------------------------- |
| 复用一期   | 必须复用现有 JobService / JobRecordService / handlers / JWT API |
| 轮询       | 保留完整代码路径，并可在详情面板中主动选择                      |
| SSE        | 复用 `fzkit` 的 `http.sse()` 接入，不替换或删除轮询             |
| 切换       | 详情面板提供 Polling / SSE 切换，默认 SSE；两种模式必须互斥     |
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
  - 详情刷新模式 B：SSE GET /api/jobs/:id/events（默认）
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
│ 刷新方式：[SSE] [Polling]；默认 SSE                        │
│ 当前连接 / 轮询状态                                        │
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
│       ├── use-job-polling.ts
│       └── use-job-sse.ts
└── constants/  # 如补充 PATHS / JOB 常量
```

规则：

- 组件目录 kebab-case，命名导出
- 不做桶导出
- HTTP 复用 `new-http`
- React Query 负责列表、详情缓存和轮询；SSE hook 通过完整快照替换这些缓存

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
- 前端由 `fzkit` 在可恢复网络异常或 401 刷新 Token 后重连；若已终态，重连后收到 snapshot 后立即结束
- `fzkit` 会自动维护并在重连时发送 `Last-Event-ID`。当前单实例服务端不持久化事件历史，也不按该游标重放；重连后的完整 snapshot 是恢复当前任务状态的依据

### 5.3 Bull Board

| 方法     | 路径            | 说明                 |
| -------- | --------------- | -------------------- |
| `GET` 等 | `/admin/queues` | Bull Board UI 与 API |

约束：

- 不走 `/api` 前缀
- 必须鉴权
- 至少暴露 default 队列 waiting/active/completed/failed

## 6. 轮询与 SSE 并存设计

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

| 模式    | 行为                                                                                                             | 停止条件                         |
| ------- | ---------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| Polling | `useQuery(GetJobById)` + `refetchInterval`（建议 1500–2000ms）                                                   | 终态、切换 SSE、关闭详情         |
| SSE     | 已提交或查看过的未终态任务各自通过 `new-http.sse('/jobs/:id/events')` 接收完整快照并更新详情与列表缓存；默认启用 | 任务终态、切换 Polling、页面卸载 |

前端切换规则：

1. 切换前先 teardown 旧模式（取消 interval / 关闭流）
2. 切换后立即拉一次当前快照或建立新连接
3. 两种模式互斥运行，避免双通道同时写状态
4. 列表页本身可用手动刷新或低频 invalidate；SSE 模式持续跟踪已提交或查看过的未终态任务，切换详情只改变当前展示任务，不关闭其他仍在跟踪的流

### 6.3 前端 hooks

`use-job-polling.ts`

- 输入：`jobId`、`enabled`
- 输出：job 数据、loading、error、isFetching
- 终态时 `refetchInterval = false`

`use-job-sse.ts`

- 输入：当前详情 `jobId`、已跟踪的未终态 `jobIds`、`enabled`
- 输出：job 数据、connectionStatus、lastEventAt、error、retry
- 使用现有 `new-http.sse()`；Token 注入、401 刷新重连、`Last-Event-ID` 续传由 `fzkit` 处理
- 以任务 ID 管理多条独立订阅；新任务加入时不得关闭既有未终态任务的流，终态后释放对应订阅
- 通过 `sequentialMessages: true` 按接收顺序处理事件；解析成功后将完整 `IJobRun` 替换到详情缓存，并复用 `syncJobToJobsListCache` 同步当前列表缓存
- 服务端为避免读快照期间漏事件而先订阅，因此 `job.updated` 可能先于本连接的 `job.snapshot` 到达；已处理任何非 snapshot 事件时，随后到达的 snapshot 不得覆盖缓存
- 终态事件主动关闭订阅，避免服务端关闭后的 EOF 触发无意义重连
- 可恢复错误按 `fzkit` 默认指数退避重连，最多 5 次；达到上限或收到不可恢复错误后展示错误并允许用户重试

`job-detail-panel` 增加紧凑的分段控件，由页面维护当前 `JobRefreshMode`。默认 `SSE`；详情轮询与 SSE 管理器必须以互斥的 `enabled` 参数运行，切换到 Polling 时关闭全部已跟踪 SSE 流，切回 SSE 时为仍未终态的已跟踪任务重新建立流。

### 6.4 学习对比文案（详情面板展示）

| 方式 | 优点               | 缺点             | 适用     |
| ---- | ------------------ | ---------------- | -------- |
| 轮询 | 实现简单、兼容性好 | 有延迟、多余请求 | 通用默认 |
| SSE  | 实时、服务端推送   | 连接管理更复杂   | 进度场景 |

页面展示当前模式与 SSE 连接状态。SSE 遇到不可恢复错误时展示重试操作，不自动降级到轮询，以便两条路径的行为保持可观察。

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

服务端所有 SSE 事件的 `data` 都是完整 `IJobRunView` 快照，不是部分字段补丁。`formatSseEvent` 通过 `JSON.stringify` 序列化后，`Date` 字段转换为 ISO 8601 字符串，`undefined` 字段省略，`null` 字段保留。

前端将 `data` 解析为完整 `IJobRun`。除 `startedAt`、`finishedAt`、`createdAt` 由服务端的 `Date | null` / `Date` 变为 JSON 字符串外，其余字段一一对应。前端应按整份对象替换详情缓存，不要做字段合并。

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
data: {"id":"123","name":"export-report","queueName":"default","status":"queued","progress":0,"payload":{"title":"report"},"result":null,"errorMessage":null,"attemptsMade":0,"maxAttempts":3,"triggerType":"manual","startedAt":null,"finishedAt":null,"createdAt":"..."}

event: job.updated
id: 2
data: {"id":"123","name":"export-report","queueName":"default","status":"active","progress":80,"payload":{"title":"report"},"result":null,"errorMessage":null,"attemptsMade":1,"maxAttempts":3,"triggerType":"manual","startedAt":"...","finishedAt":null,"createdAt":"..."}

event: job.completed
id: 3
data: {"id":"123","name":"export-report","queueName":"default","status":"completed","progress":100,"payload":{"title":"report"},"result":{"file":"mock.pdf"},"errorMessage":null,"attemptsMade":1,"maxAttempts":3,"triggerType":"manual","startedAt":"...","finishedAt":"...","createdAt":"..."}
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

前端实现：

- 通过 `fzkit` 的 `http.sse()` 使用 `fetch` + `ReadableStream` 读取 SSE，并自动带上 JWT
- 复用 `new-http` 中既有 token 获取、刷新和登出策略

不推荐把 accessToken 塞进 query string 作为主方案。

### 7.6 前端缓存与关闭规则

1. 收到 `job.snapshot`、`job.updated` 或任一终态事件时，将服务端完整 `IJobRunView` 的 JSON `data` 解析为前端完整 `IJobRun`，按整份对象替换详情缓存；不做字段级合并。
2. 详情缓存更新后，调用既有 `syncJobToJobsListCache` 更新已缓存且包含该任务的列表页；任务尚未在列表中但已符合筛选条件时，仅失效对应精确查询，以保留分页和排序契约；任务不再符合当前筛选条件时从缓存移除。
3. `job.completed`、`job.failed`、`job.cancelled` 三种事件更新缓存后立即调用订阅的 `close()`；这属于正常完成，不展示连接错误。
4. 切换刷新模式或卸载详情面板时必须关闭全部 SSE 订阅。切换任务仅更新详情展示目标，其他已跟踪且未终态任务的订阅继续运行；手动关闭后不得再次发起重连。
5. 不可恢复连接错误、JSON 解析失败或最大重试次数耗尽时保留最后一份任务快照，并由详情面板展示错误与“重试”操作；重试仅重建 SSE 订阅。

### 7.7 前端测试范围

1. 将 SSE 事件解析、缓存替换、终态判断抽为无 React 副作用的小函数；Vitest 覆盖正常 snapshot、updated、终态事件，以及 `updated` 先于 snapshot 时快照不回退状态。
2. mock `new-http.sse()` 验证订阅参数、终态主动关闭、禁用或卸载后的 cleanup，以及解析错误写入可展示的错误状态。
3. Vitest 覆盖新增任务时保留既有流、移除一个任务时不影响其他流，以及重连后的 snapshot 恢复；刷新模式通过手动验收覆盖默认 SSE、切换到 Polling 后 SSE 被禁用、切回 SSE 后轮询被禁用。

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

前端通过现有 `fzkit` 的 `http.sse()` 接入 SSE；不新增独立 SSE 依赖。

## 10. 前端实现要点

### 10.1 鉴权

- 页面挂在 `AuthGuard` 下
- 未登录跳转登录
- REST 请求继续走 `new-http` 自动带 JWT
- SSE 请求继续走 `new-http.sse()` 自动带 JWT，并复用 401 刷新与登出策略

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
- 默认 SSE 的连接状态；可切换的 Polling / SSE 刷新方式
- SSE 终态错误的重试操作

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
   - 默认 SSE 刷新，并正确更新进度和终态
   - 通过可见控件切换到轮询，且两种模式不会同时运行
   - 连续提交或查看多条未终态任务时，前一条 SSE 流不会因详情切换而被丢弃
4. 轮询终态停止；SSE 后端终态后结束流
5. SSE 在 401 后刷新 Token 重连，并在可恢复断线后使用完整 snapshot 恢复当前状态
6. Bull Board 可访问且受保护
7. 文档能讲清：
   - 任务中心 vs Bull Board
   - 轮询 vs SSE
8. 代码风格匹配现有 monorepo
9. 本地可运行并给出测试步骤

## 14. 前端 SSE 后续实现顺序

1. 前端：补充刷新模式类型与可测试的 SSE 事件缓存函数
2. 前端：新增 `use-job-sse.ts`，复用 `new-http.sse()`
3. 前端：调整 `use-job-polling.ts` 接受 `enabled`，保证模式互斥
4. 前端：增加详情面板的刷新模式切换、连接状态、错误和重试操作
5. 前端：更新页面默认模式与事件缓存同步
6. 测试、类型检查、构建与手动验收

## 15. 本地验证提纲（实现后执行）

1. 登录 web
2. 打开任务中心，触发 export-report，默认 SSE 看到 progress → completed
3. 切换到 Polling 后，确认详情继续刷新且 SSE 订阅已关闭
4. 触发 SSE 的 401 或临时断线，确认刷新 Token / 重连后由 snapshot 恢复当前状态
5. 触发 flaky-retry，观察重试与最终状态
6. 触发 cleanup-expired-refresh-tokens，观察完成
7. 对 queued/delayed 任务执行取消
8. 打开队列监控，确认需鉴权且能看到 default 队列
9. 未登录访问 `/jobs` 应跳转登录；未带 token 访问 Board/SSE 应 401

## 16. 确认后的执行边界

本设计已于 2026-08-17 确认。后续实现：

1. 仅修改 `apps/web` 中与 Jobs 详情刷新相关的类型、hooks、页面组件和测试，以及本设计文档和对应实现计划。
2. 不修改既有服务端 SSE 协议、轮询 API、Bull Board 或 refresh token 流程。
3. 完成后按需提交；不自动推送或创建 PR。
