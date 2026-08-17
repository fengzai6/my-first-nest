import { GetJobs } from "@/services/api/jobs";
import type { IFindJobsQuery } from "@/services/dtos/job";
import { useQuery } from "@tanstack/react-query";

export const JOBS_LIST_QUERY_KEY = ["jobs", "list"] as const;

export type IJobsListQueryKey = [
  ...typeof JOBS_LIST_QUERY_KEY,
  IFindJobsQuery,
];

export const useJobsList = (query: IFindJobsQuery) => {
  return useQuery({
    queryKey: [...JOBS_LIST_QUERY_KEY, query],
    queryFn: () => GetJobs(query),
    placeholderData: (prev) => prev,
  });
};
