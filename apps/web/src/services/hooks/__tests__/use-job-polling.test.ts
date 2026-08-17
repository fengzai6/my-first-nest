import {
  JOBS_LIST_QUERY_KEY,
  type IJobsListQueryKey,
} from "@/services/hooks/use-jobs-list";
import { syncJobToJobsListCache } from "@/services/hooks/use-job-polling";
import {
  JOB_STATUS,
  JOB_TRIGGER_TYPE,
  type IJobRun,
  type IJobsPage,
} from "@/services/types/job";
import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";

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

describe("syncJobToJobsListCache", () => {
  it("将详情轮询结果同步到任务列表缓存", () => {
    const queryClient = new QueryClient();
    const listQueryKey: IJobsListQueryKey = [
      ...JOBS_LIST_QUERY_KEY,
      { page: 1, pageSize: 10 },
    ];
    const detailQueryKey = ["jobs", "detail", "job-1"] as const;
    const queuedJob = createJob();
    const activeJob = createJob({
      status: JOB_STATUS.ACTIVE,
      progress: 45,
      attemptsMade: 1,
    });

    queryClient.setQueryData<IJobsPage>(listQueryKey, {
      list: [queuedJob],
      total: 1,
      page: 1,
      pageSize: 10,
    });
    queryClient.setQueryData(detailQueryKey, queuedJob);

    syncJobToJobsListCache(queryClient, activeJob);

    expect(queryClient.getQueryData<IJobsPage>(listQueryKey)?.list[0]).toEqual(
      activeJob,
    );
    expect(queryClient.getQueryData(detailQueryKey)).toEqual(queuedJob);
  });

  it("当前列表页没有该任务时不插入", () => {
    const queryClient = new QueryClient();
    const listQueryKey: IJobsListQueryKey = [
      ...JOBS_LIST_QUERY_KEY,
      { page: 1, pageSize: 10 },
    ];
    const existingJob = createJob({ id: "job-2", name: "flaky-retry" });
    const page: IJobsPage = {
      list: [existingJob],
      total: 1,
      page: 1,
      pageSize: 10,
    };

    queryClient.setQueryData<IJobsPage>(listQueryKey, page);
    syncJobToJobsListCache(
      queryClient,
      createJob({
        status: JOB_STATUS.ACTIVE,
        progress: 45,
      }),
    );

    expect(queryClient.getQueryData<IJobsPage>(listQueryKey)).toEqual(page);
  });
});
