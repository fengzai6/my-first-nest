# Jobs Phase 2 Learning Console Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** 实现任务系统二期：前端任务中心、Bull Board 队列监控、服务端 SSE 任务进度接口；前端 SSE 暂不接入。

**Architecture:** 复用一期 `shared/jobs` 的 JobService、JobRecordService、JobProcessor 和 `background-tasks` handlers。服务端新增进程内 JobEventsService，为 `/api/jobs/:id/events` 提供 SSE；Bull Board 独立挂载到 `/admin/queues` 并复用现有 JWT 鉴权；前端新增 `/jobs` 单页，用 React Query + Ant Design 展示任务列表、触发任务、详情轮询与取消。

**Tech Stack:** NestJS 11, BullMQ, TypeORM, PostgreSQL, JWT, React 19, Vite, Tailwind CSS 4, Ant Design 5, React Query, Zustand, Yarn 4.

## Global Constraints

- 使用简体中文响应。
- 复用现有 JobService / JobRecordService / handlers / JWT API。
- 轮询保留完整代码路径，不删除、不隐藏。
- SSE 本期只做后端 `/api/jobs/:id/events`，前端暂不接入。
- Bull Board 必须鉴权，不能裸奔；不替代任务中心。
- 不做动态 cron 管理台、完整用户级任务隔离/RBAC、cats 新业务 handler、WebSocket 进度、多实例 SSE 广播。
- 前端组件目录 kebab-case，命名导出，不做桶导出。
- REST 请求复用 `new-http`，前端本期不实现 SSE hook。
- 使用项目已有测试依赖 Vitest；有行为变更先补测试。

---

## File Structure

### Server

- Create `apps/server/src/shared/jobs/events/job-events.service.ts`：进程内任务事件总线，发布/订阅任务快照事件。
- Create `apps/server/src/shared/jobs/events/job-sse.util.ts`：SSE 格式化与终态判断小工具。
- Modify `apps/server/src/shared/jobs/types/job.types.ts`：补 `IJobSseEvent` / `JobSseEventName`。
- Modify `apps/server/src/shared/jobs/constants/job.constants.ts`：补 SSE 事件名常量。
- Modify `apps/server/src/shared/jobs/records/job-record.service.ts`：状态变更后发布事件。
- Modify `apps/server/src/shared/jobs/jobs.controller.ts`：新增 `GET /jobs/:id/events`。
- Modify `apps/server/src/shared/jobs/jobs.module.ts`：注册 `JobEventsService`。
- Create `apps/server/src/shared/jobs/board/job-board.module.ts`：Bull Board 独立模块。
- Create `apps/server/src/shared/jobs/board/job-board.auth.middleware.ts`：复用现有 JWT 验证 Board 访问。
- Modify `apps/server/src/shared/jobs/README.md`：补 SSE、Bull Board、任务中心边界说明。
- Modify `apps/server/package.json` / `yarn.lock`：新增 Bull Board 依赖。
- Tests: `apps/server/tests/unit/shared/jobs/events/job-events.service.spec.ts`、`apps/server/tests/unit/shared/jobs/events/job-sse.util.spec.ts`、更新 `job-record.service.spec.ts`。

### Web

- Create `apps/web/src/services/types/job.ts`：任务类型与状态常量。
- Create `apps/web/src/services/dtos/job.ts`：列表筛选与触发 DTO。
- Create `apps/web/src/services/api/jobs.ts`：列表、详情、取消 API。
- Create `apps/web/src/services/api/background-tasks.ts`：三个后台任务触发 API。
- Create `apps/web/src/services/hooks/use-jobs-list.ts`：任务列表 React Query hook。
- Create `apps/web/src/services/hooks/use-job-polling.ts`：详情轮询 hook，终态停止。
- Create `apps/web/src/pages/jobs/index.tsx`：任务中心页面。
- Create `apps/web/src/components/jobs/jobs-page-header/index.tsx`。
- Create `apps/web/src/components/jobs/job-trigger-panel/index.tsx`。
- Create `apps/web/src/components/jobs/job-filters/index.tsx`。
- Create `apps/web/src/components/jobs/job-list-table/index.tsx`。
- Create `apps/web/src/components/jobs/job-detail-panel/index.tsx`。
- Create `apps/web/src/components/jobs/job-progress-section/index.tsx`。
- Modify `apps/web/src/router/routes.tsx`：新增 `/jobs` 路由。
- Modify `apps/web/src/components/app-sidebar/index.tsx`：新增任务中心入口。
- Modify `apps/web/vite.config.ts`：新增 `/admin` 代理到 server。

---

### Task 1: Server SSE Event Bus

**Files:**
- Create: `apps/server/src/shared/jobs/events/job-events.service.ts`
- Create: `apps/server/src/shared/jobs/events/job-sse.util.ts`
- Modify: `apps/server/src/shared/jobs/constants/job.constants.ts`
- Modify: `apps/server/src/shared/jobs/types/job.types.ts`
- Modify: `apps/server/src/shared/jobs/jobs.module.ts`
- Test: `apps/server/tests/unit/shared/jobs/events/job-events.service.spec.ts`
- Test: `apps/server/tests/unit/shared/jobs/events/job-sse.util.spec.ts`

**Interfaces:**
- Produces: `JobEventsService.publish(event)`, `JobEventsService.subscribe(jobId)`, `formatSseEvent(event)`, `resolveJobSseEventName(status, fallback)`。

- [x] **Step 1: Write failing tests for event bus**

Test that subscribers only receive matching `jobId` events, multiple events stream in order, and `unsubscribe` stops future events.

- [x] **Step 2: Run tests and verify RED**

Run: `yarn workspace @my-first-nest/server test tests/unit/shared/jobs/events/job-events.service.spec.ts tests/unit/shared/jobs/events/job-sse.util.spec.ts`

Expected: FAIL because files/classes do not exist.

- [x] **Step 3: Implement constants, types, event service, util**

Add `JOB_SSE_EVENT` constants and strongly typed `IJobSseEvent` with payload based on `IJobRunView`.

- [x] **Step 4: Register service in module**

Add `JobEventsService` to `JobsModule.providers` and exports if needed by tests/controller.

- [x] **Step 5: Run tests and verify GREEN**

Run the same focused command; expected PASS.

---

### Task 2: Server Record Publishing + SSE Endpoint

**Files:**
- Modify: `apps/server/src/shared/jobs/records/job-record.service.ts`
- Modify: `apps/server/src/shared/jobs/jobs.controller.ts`
- Test: `apps/server/tests/unit/shared/jobs/records/job-record.service.spec.ts`

**Interfaces:**
- Consumes: `JobEventsService.publish`, `formatSseEvent`, `JOB_TERMINAL_STATUSES`。
- Produces: `GET /api/jobs/:id/events` server-sent stream.

- [x] **Step 1: Write failing tests for publishing**

Update record service tests to inject a mocked `JobEventsService` and assert publish after `updateProgress`, `markCompleted`, final `markAttemptFailure`, non-final `markAttemptFailure`, and `markCancelledIfCancellable` success.

- [x] **Step 2: Run tests and verify RED**

Run: `yarn workspace @my-first-nest/server test tests/unit/shared/jobs/records/job-record.service.spec.ts`

Expected: FAIL because constructor/signature/publish behavior is missing.

- [x] **Step 3: Implement publishing**

After successful state writes, load the current view where required and publish event snapshots. Avoid publishing when conditional update affected 0 rows.

- [x] **Step 4: Implement SSE controller**

Add `@Get(':id/events')` before `@Get(':id')`; use `@Res()` and `@Req()` to write `text/event-stream`, subscribe to `JobEventsService` first, then read and send snapshot, and end on terminal event or request close. Add a race test covering an event published while the snapshot is being read.

- [x] **Step 5: Run focused server tests**

Run: `yarn workspace @my-first-nest/server test tests/unit/shared/jobs/records/job-record.service.spec.ts tests/unit/shared/jobs/events/job-events.service.spec.ts tests/unit/shared/jobs/events/job-sse.util.spec.ts`

Expected: PASS.

---

### Task 3: Bull Board Integration

**Files:**
- Create: `apps/server/src/shared/jobs/board/job-board.module.ts`
- Create: `apps/server/src/shared/jobs/board/job-board.auth.middleware.ts`
- Modify: `apps/server/src/shared/jobs/jobs.module.ts`
- Modify: `apps/server/package.json`
- Modify: `yarn.lock`
- Modify: `apps/web/vite.config.ts`

**Interfaces:**
- Consumes: existing BullMQ default queue and existing JWT secret.
- Produces: protected `/admin/queues` Bull Board route.

- [x] **Step 1: Install Bull Board dependencies**

Run: `yarn workspace @my-first-nest/server add @bull-board/api @bull-board/express`

Expected: dependencies added to `apps/server/package.json` and `yarn.lock`.

- [x] **Step 2: Implement auth middleware**

Middleware validates Bearer access token using existing JWT config. Missing/invalid token returns 401.

- [x] **Step 3: Implement board module**

Create Bull Board server adapter, mount at `/admin/queues`, register `BullMQAdapter` for the default queue injected via `@InjectQueue(DEFAULT_JOB_QUEUE)`.

- [x] **Step 4: Wire module and Vite proxy**

Import board module from `JobsModule`; add `/admin` proxy to `apps/web/vite.config.ts`.

- [x] **Step 5: Build server**

Run: `yarn server:build`

Expected: PASS.

---

### Task 4: Web Services + Polling Hooks

**Files:**
- Create: `apps/web/src/services/types/job.ts`
- Create: `apps/web/src/services/dtos/job.ts`
- Create: `apps/web/src/services/api/jobs.ts`
- Create: `apps/web/src/services/api/background-tasks.ts`
- Create: `apps/web/src/services/hooks/use-jobs-list.ts`
- Create: `apps/web/src/services/hooks/use-job-polling.ts`

**Interfaces:**
- Produces: `GetJobs`, `GetJob`, `CancelJob`, `SubmitExportReport`, `SubmitFlakyRetry`, `SubmitCleanupExpiredRefreshTokens`, `useJobsList`, `useJobPolling`.

- [x] **Step 1: Add typed DTOs and API wrappers**

Use `new-http` and match existing API naming style.

- [x] **Step 2: Add React Query hooks**

List query key includes filters and pagination. Polling hook uses `refetchInterval` false for terminal statuses.

- [x] **Step 3: Run web type check**

Run: `yarn workspace @my-first-nest/web type-check`

Expected: PASS or only unrelated existing issues must be reported.

---

### Task 5: Web Jobs Page UI

**Files:**
- Create: `apps/web/src/pages/jobs/index.tsx`
- Create: `apps/web/src/components/jobs/jobs-page-header/index.tsx`
- Create: `apps/web/src/components/jobs/job-trigger-panel/index.tsx`
- Create: `apps/web/src/components/jobs/job-filters/index.tsx`
- Create: `apps/web/src/components/jobs/job-list-table/index.tsx`
- Create: `apps/web/src/components/jobs/job-detail-panel/index.tsx`
- Create: `apps/web/src/components/jobs/job-progress-section/index.tsx`
- Modify: `apps/web/src/router/routes.tsx`
- Modify: `apps/web/src/components/app-sidebar/index.tsx`

**Interfaces:**
- Consumes: services/hooks from Task 4.
- Produces: `/jobs` authenticated task center.

- [x] **Step 1: Create presentational components**

Use Ant Design Table, Card, Form, Drawer/Descriptions, Progress, Tag, Alert, Space, Button. Keep layout dense and operational.

- [x] **Step 2: Create page container**

Manage filter/page/selected job state, trigger mutations, cancel mutation, list invalidation, and detail polling.

- [x] **Step 3: Add route and sidebar item**

Route `/jobs` under `AuthGuard`; sidebar item named `任务中心`.

- [x] **Step 4: Run web type check/build**

Run: `yarn workspace @my-first-nest/web type-check` and `yarn web:build`.

Expected: PASS or report exact unrelated blockers.

---

### Task 6: Docs + Final Verification

**Files:**
- Modify: `apps/server/src/shared/jobs/README.md`
- Modify: `README.md` if roadmap needs update
- Modify: `docs/superpowers/specs/2026-07-28-jobs-phase2-learning-console-design.md` only if implementation decisions differ.

**Interfaces:**
- Produces: documented local verification steps and queue/task distinction.

- [x] **Step 1: Update docs**

Document Task Center vs Bull Board and Polling vs SSE, plus backend-only SSE verification command.

- [x] **Step 2: Run full focused verification**

Run: `yarn workspace @my-first-nest/server test tests/unit/shared/jobs/events/job-events.service.spec.ts tests/unit/shared/jobs/events/job-sse.util.spec.ts tests/unit/shared/jobs/records/job-record.service.spec.ts`

Run: `yarn server:build`

Run: `yarn workspace @my-first-nest/web type-check`

Run: `yarn web:build`

- [x] **Step 3: Inspect diff**

Run: `git status --short` and `git diff --stat`.

- [x] **Step 4: Commit**

Commit after verification succeeds: `git add ... && git commit -m "feat(jobs): add phase 2 learning console"`.

---

## Self-Review

- Spec coverage: Frontend task center, Bull Board, backend SSE, docs, auth, polling-only frontend scope are covered.
- Placeholder scan: No implementation step relies on undefined placeholders.
- Type consistency: Server event payload extends `IJobRunView`; frontend types mirror existing `job_runs` view shape.

## Execution Result

- Branch: `feat/jobs-phase2-learning-console`
- Server SSE: implemented `GET /api/jobs/:id/events`, with snapshot, update, terminal event, and terminal close.
- Frontend SSE: intentionally not implemented; page explains backend SSE is reserved for later frontend integration.
- Bull Board: implemented at `/admin/queues`, protected by existing JWT access token or existing login refresh token cookie for browser access.
- Frontend task center: implemented `/jobs` with list filters, pagination, trigger panel, cancellation, detail polling, and queue monitor entry.
- Verification passed:
  - `yarn workspace @my-first-nest/server test tests/unit/shared/jobs/events/job-events.service.spec.ts tests/unit/shared/jobs/events/job-sse.util.spec.ts tests/unit/shared/jobs/records/job-record.service.spec.ts tests/unit/shared/jobs/jobs.controller.spec.ts tests/unit/shared/jobs/board/job-board.auth.middleware.spec.ts tests/unit/common/interceptors/timeout.interceptor.spec.ts`
  - `yarn server:build`
  - `yarn workspace @my-first-nest/web type-check`
  - `yarn web:build`
- Manual smoke:
  - `PORT=8081 yarn server:dev` started successfully; `8080` was occupied by OrbStack.
  - `yarn web:dev` started on `http://localhost:5174/` because `5173` was occupied.
  - Unauthenticated `HEAD /admin/queues` returned 401.
  - Unauthenticated `HEAD /api/jobs` returned 401.
