# Jobs Frontend SSE Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 Jobs 详情默认启用 SSE，并提供与既有轮询路径互斥的可见切换控件。

**Architecture:** 复用 `new-http.sse()` 建立携带 JWT 的 SSE 订阅，依赖 fzkit 处理 Token 注入、401 刷新、断线重连和 `Last-Event-ID`。SSE 完整快照直接写入既有 React Query 详情缓存，并使用现有 `syncJobToJobsListCache` 更新列表缓存；轮询继续由 `useQuery` 驱动，只有当前选择 Polling 时启用。

**Tech Stack:** React 19、TypeScript、TanStack Query、Ant Design 6、Vitest、fzkit 0.2.1。

## Global Constraints

- 使用简体中文响应；不新增依赖。
- 只修改 `apps/web` 中 Jobs 详情刷新关联的类型、hooks、页面、组件和测试，以及已有设计/计划文档。
- 复用 `new-http.sse()`，不使用原生 `EventSource`，不把 Token 放入 query string。
- `Polling` 与 `SSE` 必须互斥运行；页面默认 `SSE`，轮询实现保留且可切换。
- SSE `data` 是完整 `IJobRun` 快照，必须整对象替换缓存，禁止字段级合并。
- 服务端未实现事件历史回放；`Last-Event-ID` 由 fzkit 自动维护，重连后的 `job.snapshot` 是当前状态恢复依据。
- 服务端可能在 `job.snapshot` 前发送 `job.updated`；同一连接已处理非 snapshot 事件时，后到 snapshot 不得覆盖缓存。
- 终态、模式切换和组件卸载都必须关闭 SSE；任务切换仅切换详情展示，其他已跟踪的未终态任务保持订阅；终态关闭不显示错误。
- SSE 可恢复重连最多 5 次；终态错误、消息解析错误和重试耗尽保留最后快照并提供手动重试，不自动降级到轮询。
- TypeScript 不使用 `any`；测试直接验证原始生产实现，不重写业务逻辑。
- 未经用户明确要求，不创建 Git 提交、push 或 PR。

---

## File Structure

```text
apps/web/src/
├── components/jobs/
│   ├── job-detail-panel/index.tsx               # 模式控件、状态、错误与详情展示
│   └── job-refresh-mode-toggle/index.tsx        # Polling / SSE 分段控件
├── pages/jobs/index.tsx                          # 默认模式，两个 hooks 的互斥启用
└── services/
    ├── hooks/
    │   ├── job-sse.ts                            # SSE 事件解析、缓存写入和订阅生命周期
    │   ├── use-job-polling.ts                    # 增加 enabled，导出详情 query key
    │   ├── use-job-sse.ts                        # React 生命周期、状态和手动重试
    │   └── __tests__/
    │       ├── job-sse.test.ts                   # SSE 订阅与缓存行为
    │       └── use-job-polling.test.ts           # 保持列表缓存同步覆盖
    └── types/job.ts                              # 刷新模式与 SSE 事件名类型
```

### Task 1: SSE 协议与缓存订阅

**Files:**
- Modify: `apps/web/src/services/types/job.ts`
- Modify: `apps/web/src/services/hooks/use-job-polling.ts`
- Create: `apps/web/src/services/hooks/job-sse.ts`
- Create: `apps/web/src/services/hooks/__tests__/job-sse.test.ts`
- Modify: `apps/web/src/services/hooks/__tests__/use-job-polling.test.ts`

**Interfaces:**
- Produces `JOB_REFRESH_MODE`、`JobRefreshMode`、`JOB_SSE_EVENT`、`JobSseEventName`。
- Produces `getJobDetailQueryKey(jobId: string)`，供轮询与 SSE 共用 `['jobs', 'detail', jobId]` 缓存键。
- Produces `subscribeToJobSse(options): (() => void) | undefined`；它写入 React Query 缓存，并由返回函数关闭 `SseSubscription`。

- [x] **Step 1: 写 SSE 订阅的失败测试**

在 `job-sse.test.ts` mock `@/services/api/new-http` 的 `sse` 方法。使用真实 `QueryClient` 和现有 `syncJobToJobsListCache`，准备 `job-1` 的详情/列表缓存与可控 `SseSubscription`。

```ts
it("将完整 SSE 快照替换详情与任务列表缓存", async () => {
  const cleanup = subscribeToJobSse({
    jobId: "job-1",
    enabled: true,
    queryClient,
    onConnectionState: vi.fn(),
    onError: vi.fn(),
    onEventReceived: vi.fn(),
  });

  await sseOptions?.onMessage?.({
    event: JOB_SSE_EVENT.SNAPSHOT,
    data: JSON.stringify(activeJob),
  });

  expect(queryClient.getQueryData(getJobDetailQueryKey("job-1"))).toEqual(
    activeJob,
  );
  expect(queryClient.getQueryData<IJobsPage>(listKey)?.list[0]).toEqual(
    activeJob,
  );
  cleanup?.();
});
```

再添加以下独立断言：

```ts
it("非 snapshot 事件先到时不让后续 snapshot 回退缓存", async () => {
  await sseOptions?.onOpen?.(new Response());
  await sseOptions?.onMessage?.(updatedEvent);
  await sseOptions?.onMessage?.(staleSnapshotEvent);

  expect(queryClient.getQueryData(getJobDetailQueryKey("job-1"))).toEqual(
    updatedJob,
  );
});

it("终态事件更新缓存后关闭订阅", async () => {
  await sseOptions?.onMessage?.(completedEvent);

  expect(subscription.close).toHaveBeenCalledTimes(1);
  expect(onError).not.toHaveBeenCalled();
});

it("禁用订阅不发请求，清理函数关闭活动订阅", () => {
  expect(subscribeToJobSse({ ...options, enabled: false })).toBeUndefined();
  expect(sse).not.toHaveBeenCalled();

  const cleanup = subscribeToJobSse(options);
  cleanup?.();
  expect(subscription.close).toHaveBeenCalledTimes(1);
});

it("无法解析的 SSE 数据写入错误并关闭订阅", async () => {
  await sseOptions?.onMessage?.({
    event: JOB_SSE_EVENT.UPDATED,
    data: "not-json",
  });

  expect(onError).toHaveBeenCalledWith(expect.any(Error));
  expect(subscription.close).toHaveBeenCalledTimes(1);
});
```

- [x] **Step 2: 运行测试，确认 RED**

Run: `cd apps/web && yarn test src/services/hooks/__tests__/job-sse.test.ts`

Expected: FAIL，因为 `job-sse.ts`、SSE 常量和 `getJobDetailQueryKey` 尚不存在。

- [x] **Step 3: 增加共享类型和详情缓存键**

在 `types/job.ts` 增加与服务端同名的 `JOB_SSE_EVENT`，并定义刷新模式：

```ts
export const JOB_REFRESH_MODE = {
  POLLING: "polling",
  SSE: "sse",
} as const;

export type JobRefreshMode =
  (typeof JOB_REFRESH_MODE)[keyof typeof JOB_REFRESH_MODE];

export const JOB_SSE_EVENT = {
  SNAPSHOT: "job.snapshot",
  UPDATED: "job.updated",
  COMPLETED: "job.completed",
  FAILED: "job.failed",
  CANCELLED: "job.cancelled",
} as const;

export type JobSseEventName =
  (typeof JOB_SSE_EVENT)[keyof typeof JOB_SSE_EVENT];
```

在 `use-job-polling.ts` 增加共享 key，原有轮询使用它：

```ts
export const getJobDetailQueryKey = (jobId: string) =>
  ["jobs", "detail", jobId] as const;
```

- [x] **Step 4: 实现可测试的 SSE 订阅函数**

创建 `job-sse.ts`。函数接收 `jobId`、`enabled`、`QueryClient` 和状态回调；未启用或缺少任务 ID 时返回 `undefined`。启用时调用：

```ts
export interface ISubscribeToJobSseOptions {
  jobId: string | null;
  enabled: boolean;
  queryClient: QueryClient;
  onConnectionState: (state: SseState) => void;
  onError: (error: Error) => void;
  onEventReceived: () => void;
}

export const subscribeToJobSse = ({
  jobId,
  enabled,
  queryClient,
  onConnectionState,
  onError,
  onEventReceived,
}: ISubscribeToJobSseOptions) => {
  if (!enabled || !jobId) return undefined;

  let disposed = false;
  let terminal = false;
  let receivedNonSnapshotEvent = false;
  let receivedError = false;
  let subscription: SseSubscription;

  const reportError = (error: Error) => {
    if (disposed || terminal || receivedError) return;
    receivedError = true;
    onError(error);
  };

  subscription = http.sse(`/jobs/${jobId}/events`, {
  maxRetries: 5,
  sequentialMessages: true,
  onOpen: () => {
    if (disposed) return;
    receivedNonSnapshotEvent = false;
    onConnectionState("open");
  },
  onRetry: () => {
    if (!disposed) onConnectionState("retrying");
  },
  onError: (error) => reportError(error),
  onMessage: async (event) => {
    if (disposed || !isJobSseEventName(event.event)) return;
    if (event.event === JOB_SSE_EVENT.SNAPSHOT && receivedNonSnapshotEvent) {
      return;
    }

    let data: unknown;
    try {
      data = JSON.parse(event.data);
    } catch {
      reportError(new Error("任务 SSE 事件数据不是有效 JSON"));
      subscription.close();
      return;
    }

    if (!isJobRun(data)) {
      reportError(new Error("任务 SSE 事件数据格式无效"));
      subscription.close();
      return;
    }

    if (event.event !== JOB_SSE_EVENT.SNAPSHOT) {
      receivedNonSnapshotEvent = true;
    }

    queryClient.setQueryData(getJobDetailQueryKey(jobId), data);
    syncJobToJobsListCache(queryClient, data);
    onEventReceived();

    if (isTerminalJob(data)) {
      terminal = true;
      subscription.close();
    }
  },
  onClose: (reason) => {
    if (disposed) return;
    onConnectionState("closed");
    if (!terminal && reason !== "manual" && reason !== "signal") {
      reportError(new Error(`任务 SSE 订阅已关闭：${reason}`));
    }
  },
});

  return () => {
    disposed = true;
    subscription.close();
  };
};
```

在同一文件中实现 `isJobSseEventName`、`isJobRun` 和 `isTerminalJob`：先以 `Record<string, unknown>` 检查对象，再校验 `id`、`name`、`queueName`、`progress`、`attemptsMade`、`maxAttempts`、`createdAt` 为预期基础类型，以及 `status`、`triggerType` 分别属于既有 `JOB_STATUS`、`JOB_TRIGGER_TYPE` 的 value union；可选字段存在时再校验 `errorMessage`、时间字段的类型。解析错误调用 `reportError` 后关闭订阅；`onOpen` 重置“已收到非 snapshot”标记，确保内部重连后的 snapshot 能恢复状态。cleanup 先标记 `disposed`，再关闭订阅，防止卸载后回调写 React 状态。

- [x] **Step 5: 运行聚焦测试，确认 GREEN**

Run: `cd apps/web && yarn test src/services/hooks/__tests__/job-sse.test.ts src/services/hooks/__tests__/use-job-polling.test.ts`

Expected: PASS，且列表缓存同步的既有三项断言继续通过。

### Task 2: React SSE Hook 与轮询互斥启用

**Files:**
- Create: `apps/web/src/services/hooks/use-job-sse.ts`
- Modify: `apps/web/src/services/hooks/use-job-polling.ts`
- Test: `apps/web/src/services/hooks/__tests__/job-sse.test.ts`

**Interfaces:**
- Produces `useJobSse(jobId: string | null, enabled: boolean)`。
- 返回 `{ data, error, isLoading, isFetching, connectionState, lastEventAt, retry }`。
- `useJobPolling(jobId, enabled)` 只在 `enabled && Boolean(jobId)` 时请求与轮询。

- [x] **Step 1: 扩展失败测试，锁定订阅配置**

在 `job-sse.test.ts` 为 `subscribeToJobSse` 增加配置断言，使 hook 可以依赖这个已验证的适配层：

```ts
expect(sse).toHaveBeenCalledWith(
  "/jobs/job-1/events",
  expect.objectContaining({
    maxRetries: 5,
    sequentialMessages: true,
  }),
);
```

并断言 `onRetry` 将状态回调更新为 `"retrying"`，`onOpen` 更新为 `"open"`。这两个断言在订阅实现缺少选项或生命周期回调时应失败。

- [x] **Step 2: 运行测试，确认 RED**

Run: `cd apps/web && yarn test src/services/hooks/__tests__/job-sse.test.ts`

Expected: FAIL，直到订阅实现按固定选项和连接状态回调完成。

- [x] **Step 3: 实现 useJobSse**

通过禁用的 React Query observer 订阅同一详情缓存键，但不由它自动发出 REST 请求：

```ts
const detailQuery = useQuery({
  queryKey: getJobDetailQueryKey(jobId ?? ""),
  queryFn: () => GetJob(jobId ?? ""),
  enabled: false,
});
```

使用 `useEffectEvent` 封装状态写入回调，并以任务 ID 管理 `subscribeToJobSse` 返回的多个 cleanup。提交或查看新任务时加入对应订阅，不能关闭其他已跟踪的未终态任务；切换 Polling 或卸载时关闭全部订阅。`retry()` 仅重建当前详情任务的 SSE 订阅。

派生返回值：

```ts
return {
  data: detailQuery.data,
  error,
  isLoading: Boolean(jobId && enabled && !detailQuery.data && !error),
  isFetching:
    connectionState === "connecting" || connectionState === "retrying",
  connectionState,
  lastEventAt,
  retry,
};
```

- [x] **Step 4: 让轮询显式接收 enabled**

将函数签名调整为：

```ts
export const useJobPolling = (jobId: string | null, enabled: boolean) => {
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: getJobDetailQueryKey(jobId ?? ""),
    queryFn: async () => {
      const job = await GetJob(jobId ?? "");
      syncJobToJobsListCache(queryClient, job);
      return job;
    },
    enabled: enabled && Boolean(jobId),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status && JOB_TERMINAL_STATUSES.includes(status) ? false : 2000;
    },
  });
};
```

轮询成功后继续调用 `syncJobToJobsListCache`；终态时仍返回 `false` 停止 `refetchInterval`。

- [x] **Step 5: 运行 hooks 测试与类型检查**

Run: `cd apps/web && yarn test src/services/hooks/__tests__/job-sse.test.ts src/services/hooks/__tests__/use-job-polling.test.ts`

Run: `cd apps/web && yarn type-check`

Expected: 两个测试文件通过；TypeScript 不出现未使用变量、错误的 SSE 类型导入或 hook 签名调用错误。

### Task 3: Jobs 页面模式切换与详情状态

**Files:**
- Create: `apps/web/src/components/jobs/job-refresh-mode-toggle/index.tsx`
- Modify: `apps/web/src/components/jobs/job-detail-panel/index.tsx`
- Modify: `apps/web/src/pages/jobs/index.tsx`
- Modify: `docs/superpowers/specs/2026-07-28-jobs-phase2-learning-console-design.md` only if implementation differs from the approved design

**Interfaces:**
- `JobRefreshModeToggle` 接收 `mode: JobRefreshMode` 与 `onChange(mode: JobRefreshMode)`。
- `JobDetailPanel` 接收当前模式、SSE 连接状态、最近事件时间、错误和重试函数。
- `Jobs` 同时调用两个详情 hook，但以 `enabled` 参数保证仅当前模式工作。

- [x] **Step 1: 创建刷新模式控件**

使用 Ant Design `Segmented`，不新增自绘按钮：

```tsx
<Segmented<JobRefreshMode>
  value={mode}
  options={[
    { label: "SSE", value: JOB_REFRESH_MODE.SSE },
    { label: "Polling", value: JOB_REFRESH_MODE.POLLING },
  ]}
  onChange={onChange}
/>
```

该组件不维护本地模式状态，确保任务切换后当前选择保持不变。

- [x] **Step 2: 页面默认 SSE 并启用互斥 hooks**

在 `Jobs` 增加：

```ts
const [refreshMode, setRefreshMode] = useState<JobRefreshMode>(
  JOB_REFRESH_MODE.SSE,
);
const pollingDetailQuery = useJobPolling(
  selectedJobId,
  refreshMode === JOB_REFRESH_MODE.POLLING,
);
const sseDetailQuery = useJobSse(
  selectedJobId,
  refreshMode === JOB_REFRESH_MODE.SSE,
);
```

根据 `refreshMode` 选择传给详情面板的 `data`、loading、fetching、error 和 retry 函数。删除页面顶部已过期的“后续再接入 SSE”说明；任务列表的加载失败 Alert 保持不变。

- [x] **Step 3: 更新详情面板**

将模式控件放在 `Card` 的 `extra`，使详情为空或 SSE 出错时仍可切换到 Polling。把错误 Alert 放在详情内容前而不是提前 `return`，这样 SSE 出错时最后一份完整任务快照仍可见。

SSE 模式显示连接状态（`连接中`、`已连接`、`重连中`、`已关闭`）与最近事件时间；Polling 模式沿用既有 `isFetching` 的“刷新中”。复用 `onRetry`：Polling 调用 query 的 `refetch`，SSE 调用 hook 的 `retry`。终态手动关闭不产生错误提示。

- [x] **Step 4: 运行完整前端验证**

Run: `cd apps/web && yarn test`

Run: `cd apps/web && yarn type-check`

Run: `cd apps/web && yarn lint`

Run: `cd apps/web && yarn build`

Expected: 全部命令以退出码 0 完成；现有 `new-http` SSE 集成测试继续覆盖 401 刷新、重连和事件游标。

- [x] **Step 5: 手动验证与文档核对**

启动服务端和 Web 开发服务器，使用真实登录会话：

1. 在 `/jobs` 触发 export-report，确认默认 SSE 将进度更新到 completed。
2. 连续触发多条长 export-report，确认新任务订阅建立后，前一条任务仍通过 SSE 更新列表状态与进度。
3. 切换 Polling，确认详情继续更新；再切回 SSE，确认轮询停止且新 SSE 订阅建立。
4. 选择已完成任务，确认 snapshot 后 SSE 立即关闭且没有重连错误。
5. 对照已确认的设计文档核对默认模式、错误重试、缓存替换和“不自动降级”均与实现一致；仅在有实现差异时修改设计文档。

### Plan Self-Review

- **Spec coverage:** 覆盖默认 SSE、可见模式切换、轮询保留、JWT/401 恢复复用、完整快照缓存替换、事件先后竞态、终态关闭、错误重试、测试与手动验收；不修改服务端 SSE 协议。
- **Placeholder scan:** 没有占位标记或未定义的实现步骤；每个行为均指向具体文件、接口与验证命令。
- **Type consistency:** `JobRefreshMode` 和 `JobSseEventName` 定义在 `types/job.ts`；`SseSubscription`、`SseState`、`SseEvent` 从 `fzkit/http-client` 以类型导入；详情缓存统一使用 `getJobDetailQueryKey(jobId)`。
