import { GetJob } from "@/services/api/jobs";
import type { IFindJobsQuery } from "@/services/dtos/job";
import { JOBS_LIST_QUERY_KEY } from "@/services/hooks/use-jobs-list";
import {
  JOB_TERMINAL_STATUSES,
  type IJobRun,
  type IJobsPage,
} from "@/services/types/job";
import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";

export const getJobDetailQueryKey = (jobId: string) =>
  ["jobs", "detail", jobId] as const;

export const syncJobToJobsListCache = (
  queryClient: QueryClient,
  job: IJobRun,
) => {
  const queries = queryClient.getQueriesData<IJobsPage>({
    queryKey: JOBS_LIST_QUERY_KEY,
  });

  for (const [queryKey, current] of queries) {
    if (!current?.list.some((item) => item.id === job.id)) {
      continue;
    }

    const filters = queryKey[2] as IFindJobsQuery | undefined;
    const matchesName = !filters?.name || job.name === filters.name;
    const matchesStatus = !filters?.status || job.status === filters.status;

    if (!matchesName || !matchesStatus) {
      queryClient.setQueryData<IJobsPage>(queryKey, {
        ...current,
        list: current.list.filter((item) => item.id !== job.id),
        total: Math.max(0, current.total - 1),
      });
      continue;
    }

    queryClient.setQueryData<IJobsPage>(queryKey, {
      ...current,
      list: current.list.map((item) => (item.id === job.id ? job : item)),
    });
  }
};

export const useJobPolling = (jobId: string | null, enabled = true) => {
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
      if (status && JOB_TERMINAL_STATUSES.includes(status)) return false;
      return 2000;
    },
  });
};
