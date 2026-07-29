import { GetJob } from "@/services/api/jobs";
import { JOB_TERMINAL_STATUSES } from "@/services/types/job";
import { useQuery } from "@tanstack/react-query";

export const useJobPolling = (jobId: string | null) => {
  return useQuery({
    queryKey: ["jobs", "detail", jobId],
    queryFn: () => GetJob(jobId ?? ""),
    enabled: Boolean(jobId),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status && JOB_TERMINAL_STATUSES.includes(status)) return false;
      return 2000;
    },
  });
};
