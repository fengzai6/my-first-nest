import { GetJob } from "@/services/api/jobs";
import { JOBS_LIST_QUERY_KEY } from "@/services/hooks/use-jobs-list";
import {
  JOB_TERMINAL_STATUSES,
  type IJobRun,
  type IJobsPage,
} from "@/services/types/job";
import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";

export const syncJobToJobsListCache = (
  queryClient: QueryClient,
  job: IJobRun,
) => {
  queryClient.setQueriesData<IJobsPage>(
    { queryKey: JOBS_LIST_QUERY_KEY },
    (current) => {
      if (!current?.list.some((item) => item.id === job.id)) {
        return current;
      }

      return {
        ...current,
        list: current.list.map((item) => (item.id === job.id ? job : item)),
      };
    },
  );
};

export const useJobPolling = (jobId: string | null) => {
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: ["jobs", "detail", jobId],
    queryFn: async () => {
      const job = await GetJob(jobId ?? "");
      syncJobToJobsListCache(queryClient, job);
      return job;
    },
    enabled: Boolean(jobId),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status && JOB_TERMINAL_STATUSES.includes(status)) return false;
      return 2000;
    },
  });
};
