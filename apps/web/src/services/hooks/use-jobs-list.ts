import { GetJobs } from "@/services/api/jobs";
import type { IFindJobsQuery } from "@/services/dtos/job";
import { useQuery } from "@tanstack/react-query";

export const useJobsList = (query: IFindJobsQuery) => {
  return useQuery({
    queryKey: ["jobs", query],
    queryFn: () => GetJobs(query),
    placeholderData: (prev) => prev,
  });
};
