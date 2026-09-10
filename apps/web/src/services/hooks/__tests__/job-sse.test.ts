import {
  JOB_SSE_EVENT,
  JOB_STATUS,
  JOB_TRIGGER_TYPE,
  type IJobRun,
  type IJobsPage,
} from "@/services/types/job";
import { QueryClient } from "@tanstack/react-query";
import type { SseOptions, SseSubscription } from "fzkit/http-client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const sse = vi.hoisted(() => vi.fn());

vi.mock("@/services/api/new-http", () => ({
  default: { sse },
}));

import { createJobSseSubscriptionManager, subscribeToJobSse } from "../job-sse";
import { getJobDetailQueryKey } from "../use-job-polling";
import { JOBS_LIST_QUERY_KEY, type IJobsListQueryKey } from "../use-jobs-list";

const createJob = (overrides: Partial<IJobRun> = {}): IJobRun => ({
  id: "job-1",
  name: "export-report",
  queueName: "default",
  status: JOB_STATUS.QUEUED,
  progress: 0,
  attemptsMade: 0,
  maxAttempts: 3,
  triggerType: JOB_TRIGGER_TYPE.MANUAL,
  createdAt: "2026-08-17T00:00:00.000Z",
  ...overrides,
});

describe("subscribeToJobSse", () => {
  let queryClient: QueryClient;
  let subscription: SseSubscription;
  let sseOptions: SseOptions | undefined;
  let listQueryKey: IJobsListQueryKey;

  beforeEach(() => {
    queryClient = new QueryClient();
    subscription = {
      close: vi.fn(),
      lastEventId: undefined,
      state: "connecting",
    };
    sseOptions = undefined;
    listQueryKey = [...JOBS_LIST_QUERY_KEY, { page: 1, pageSize: 10 }];
    sse.mockReset();
    sse.mockImplementation((_url: string, options: SseOptions) => {
      sseOptions = options;
      return subscription;
    });
  });

  it("将完整 SSE 快照替换详情与任务列表缓存", async () => {
    const queuedJob = createJob();
    const activeJob = createJob({
      status: JOB_STATUS.ACTIVE,
      progress: 50,
      attemptsMade: 1,
    });
    const onEventReceived = vi.fn();

    queryClient.setQueryData<IJobsPage>(listQueryKey, {
      list: [queuedJob],
      total: 1,
      page: 1,
      pageSize: 10,
    });

    const cleanup = subscribeToJobSse({
      jobId: "job-1",
      enabled: true,
      queryClient,
      onConnectionState: vi.fn(),
      onError: vi.fn(),
      onEventReceived,
    });

    await sseOptions?.onMessage?.({
      event: JOB_SSE_EVENT.SNAPSHOT,
      data: JSON.stringify(activeJob),
    });

    expect(sse).toHaveBeenCalledWith(
      "/jobs/job-1/events",
      expect.objectContaining({
        maxRetries: 5,
        sequentialMessages: true,
      }),
    );
    expect(queryClient.getQueryData(getJobDetailQueryKey("job-1"))).toEqual(
      activeJob,
    );
    expect(queryClient.getQueryData<IJobsPage>(listQueryKey)?.list[0]).toEqual(
      activeJob,
    );
    expect(onEventReceived).toHaveBeenCalledTimes(1);

    cleanup?.();
  });

  it("非 snapshot 事件先到时不让后续 snapshot 回退缓存", async () => {
    const updatedJob = createJob({
      status: JOB_STATUS.ACTIVE,
      progress: 60,
      attemptsMade: 1,
    });
    const staleSnapshotJob = createJob({ progress: 30 });

    subscribeToJobSse({
      jobId: "job-1",
      enabled: true,
      queryClient,
      onConnectionState: vi.fn(),
      onError: vi.fn(),
      onEventReceived: vi.fn(),
    });

    await sseOptions?.onOpen?.(new Response());
    await sseOptions?.onMessage?.({
      event: JOB_SSE_EVENT.UPDATED,
      data: JSON.stringify(updatedJob),
    });
    await sseOptions?.onMessage?.({
      event: JOB_SSE_EVENT.SNAPSHOT,
      data: JSON.stringify(staleSnapshotJob),
    });

    expect(queryClient.getQueryData(getJobDetailQueryKey("job-1"))).toEqual(
      updatedJob,
    );
  });

  it("新增任务订阅时保留前一条任务流并分别同步缓存", async () => {
    const subscriptionsByUrl = new Map<string, SseSubscription>();
    const optionsByUrl = new Map<string, SseOptions>();
    const jobOne = createJob({
      id: "job-1",
      status: JOB_STATUS.ACTIVE,
      progress: 50,
    });
    const jobTwo = createJob({
      id: "job-2",
      status: JOB_STATUS.ACTIVE,
      progress: 20,
    });

    sse.mockImplementation((url: string, options: SseOptions) => {
      const nextSubscription: SseSubscription = {
        close: vi.fn(),
        lastEventId: undefined,
        state: "connecting",
      };
      subscriptionsByUrl.set(url, nextSubscription);
      optionsByUrl.set(url, options);
      return nextSubscription;
    });

    const manager = createJobSseSubscriptionManager({
      queryClient,
      createCallbacks: () => ({
        onConnectionState: vi.fn(),
        onError: vi.fn(),
        onEventReceived: vi.fn(),
      }),
    });

    manager.sync(["job-1"]);
    manager.sync(["job-1", "job-2"]);

    expect(
      subscriptionsByUrl.get("/jobs/job-1/events")?.close,
    ).not.toHaveBeenCalled();
    expect(sse).toHaveBeenCalledTimes(2);

    await optionsByUrl.get("/jobs/job-1/events")?.onMessage?.({
      event: JOB_SSE_EVENT.UPDATED,
      data: JSON.stringify(jobOne),
    });
    await optionsByUrl.get("/jobs/job-2/events")?.onMessage?.({
      event: JOB_SSE_EVENT.UPDATED,
      data: JSON.stringify(jobTwo),
    });

    expect(queryClient.getQueryData(getJobDetailQueryKey("job-1"))).toEqual(
      jobOne,
    );
    expect(queryClient.getQueryData(getJobDetailQueryKey("job-2"))).toEqual(
      jobTwo,
    );

    manager.close();

    expect(
      subscriptionsByUrl.get("/jobs/job-1/events")?.close,
    ).toHaveBeenCalledTimes(1);
    expect(
      subscriptionsByUrl.get("/jobs/job-2/events")?.close,
    ).toHaveBeenCalledTimes(1);
  });

  it("移除跟踪任务时只关闭对应流并保留其他任务流", async () => {
    const subscriptionsByUrl = new Map<string, SseSubscription>();
    const optionsByUrl = new Map<string, SseOptions>();
    const activeJob = createJob({
      id: "job-2",
      status: JOB_STATUS.ACTIVE,
      progress: 50,
    });

    sse.mockImplementation((url: string, options: SseOptions) => {
      const nextSubscription: SseSubscription = {
        close: vi.fn(),
        lastEventId: undefined,
        state: "connecting",
      };
      subscriptionsByUrl.set(url, nextSubscription);
      optionsByUrl.set(url, options);
      return nextSubscription;
    });

    const manager = createJobSseSubscriptionManager({
      queryClient,
      createCallbacks: () => ({
        onConnectionState: vi.fn(),
        onError: vi.fn(),
        onEventReceived: vi.fn(),
      }),
    });

    manager.sync(["job-1", "job-2"]);
    manager.sync(["job-2"]);

    expect(
      subscriptionsByUrl.get("/jobs/job-1/events")?.close,
    ).toHaveBeenCalledTimes(1);
    expect(
      subscriptionsByUrl.get("/jobs/job-2/events")?.close,
    ).not.toHaveBeenCalled();

    await optionsByUrl.get("/jobs/job-2/events")?.onMessage?.({
      event: JOB_SSE_EVENT.UPDATED,
      data: JSON.stringify(activeJob),
    });

    expect(queryClient.getQueryData(getJobDetailQueryKey("job-2"))).toEqual(
      activeJob,
    );
  });

  it("重连后允许新的 snapshot 恢复缓存", async () => {
    const activeJob = createJob({
      status: JOB_STATUS.ACTIVE,
      progress: 80,
      attemptsMade: 1,
    });
    const snapshotJob = createJob({ progress: 30 });

    subscribeToJobSse({
      jobId: "job-1",
      enabled: true,
      queryClient,
      onConnectionState: vi.fn(),
      onError: vi.fn(),
      onEventReceived: vi.fn(),
    });

    await sseOptions?.onMessage?.({
      event: JOB_SSE_EVENT.UPDATED,
      data: JSON.stringify(activeJob),
    });
    await sseOptions?.onOpen?.(new Response());
    await sseOptions?.onMessage?.({
      event: JOB_SSE_EVENT.SNAPSHOT,
      data: JSON.stringify(snapshotJob),
    });

    expect(queryClient.getQueryData(getJobDetailQueryKey("job-1"))).toEqual(
      snapshotJob,
    );
  });

  it("终态事件更新缓存后关闭订阅", async () => {
    const completedJob = createJob({
      status: JOB_STATUS.COMPLETED,
      progress: 100,
      finishedAt: "2026-08-17T00:00:10.000Z",
    });
    const onError = vi.fn();

    subscribeToJobSse({
      jobId: "job-1",
      enabled: true,
      queryClient,
      onConnectionState: vi.fn(),
      onError,
      onEventReceived: vi.fn(),
    });

    await sseOptions?.onMessage?.({
      event: JOB_SSE_EVENT.COMPLETED,
      data: JSON.stringify(completedJob),
    });

    expect(queryClient.getQueryData(getJobDetailQueryKey("job-1"))).toEqual(
      completedJob,
    );
    expect(subscription.close).toHaveBeenCalledTimes(1);

    await sseOptions?.onClose?.("manual");

    expect(onError).not.toHaveBeenCalled();
  });

  it("禁用订阅不发请求，清理函数关闭活动订阅", () => {
    const options = {
      jobId: "job-1",
      enabled: true,
      queryClient,
      onConnectionState: vi.fn(),
      onError: vi.fn(),
      onEventReceived: vi.fn(),
    };

    expect(subscribeToJobSse({ ...options, enabled: false })).toBeUndefined();
    expect(sse).not.toHaveBeenCalled();

    const cleanup = subscribeToJobSse(options);
    cleanup?.();

    expect(subscription.close).toHaveBeenCalledTimes(1);
  });

  it("无法解析的 SSE 数据写入错误并关闭订阅", async () => {
    const onError = vi.fn();

    subscribeToJobSse({
      jobId: "job-1",
      enabled: true,
      queryClient,
      onConnectionState: vi.fn(),
      onError,
      onEventReceived: vi.fn(),
    });

    await sseOptions?.onMessage?.({
      event: JOB_SSE_EVENT.UPDATED,
      data: "not-json",
    });

    expect(onError).toHaveBeenCalledWith(expect.any(Error));
    expect(subscription.close).toHaveBeenCalledTimes(1);
  });

  it("字段不完整的 SSE 数据写入错误并关闭订阅", async () => {
    const onError = vi.fn();

    subscribeToJobSse({
      jobId: "job-1",
      enabled: true,
      queryClient,
      onConnectionState: vi.fn(),
      onError,
      onEventReceived: vi.fn(),
    });

    await sseOptions?.onMessage?.({
      event: JOB_SSE_EVENT.UPDATED,
      data: JSON.stringify({ id: "job-1", status: JOB_STATUS.ACTIVE }),
    });

    expect(onError).toHaveBeenCalledWith(expect.any(Error));
    expect(subscription.close).toHaveBeenCalledTimes(1);
  });

  it("事件任务 ID 与订阅不匹配时拒绝写入并关闭订阅", async () => {
    const onError = vi.fn();
    const mismatchedJob = createJob({
      id: "job-2",
      status: JOB_STATUS.ACTIVE,
      progress: 50,
    });

    subscribeToJobSse({
      jobId: "job-1",
      enabled: true,
      queryClient,
      onConnectionState: vi.fn(),
      onError,
      onEventReceived: vi.fn(),
    });

    await sseOptions?.onMessage?.({
      event: JOB_SSE_EVENT.UPDATED,
      data: JSON.stringify(mismatchedJob),
    });

    expect(onError).toHaveBeenCalledWith(expect.any(Error));
    expect(subscription.close).toHaveBeenCalledTimes(1);
    expect(
      queryClient.getQueryData(getJobDetailQueryKey("job-1")),
    ).toBeUndefined();
  });

  it("重试耗尽时写入可展示的订阅错误", async () => {
    const onError = vi.fn();

    subscribeToJobSse({
      jobId: "job-1",
      enabled: true,
      queryClient,
      onConnectionState: vi.fn(),
      onError,
      onEventReceived: vi.fn(),
    });

    await sseOptions?.onClose?.("max-retries");

    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ message: "任务 SSE 订阅已关闭：max-retries" }),
    );
  });

  it("连接成功和重连时更新连接状态", async () => {
    const onConnectionState = vi.fn();

    subscribeToJobSse({
      jobId: "job-1",
      enabled: true,
      queryClient,
      onConnectionState,
      onError: vi.fn(),
      onEventReceived: vi.fn(),
    });

    await sseOptions?.onOpen?.(new Response());
    await sseOptions?.onRetry?.({
      attempt: 1,
      delayMs: 1000,
      reason: "error",
    });

    expect(onConnectionState).toHaveBeenNthCalledWith(1, "open");
    expect(onConnectionState).toHaveBeenNthCalledWith(2, "retrying");
  });

  it("连接重新打开后可以继续上报错误", async () => {
    const onError = vi.fn();

    subscribeToJobSse({
      jobId: "job-1",
      enabled: true,
      queryClient,
      onConnectionState: vi.fn(),
      onError,
      onEventReceived: vi.fn(),
    });

    await sseOptions?.onError?.(new Error("first"));
    await sseOptions?.onOpen?.(new Response());
    await sseOptions?.onError?.(new Error("second"));

    expect(onError).toHaveBeenNthCalledWith(1, new Error("first"));
    expect(onError).toHaveBeenNthCalledWith(2, new Error("second"));
  });
});
