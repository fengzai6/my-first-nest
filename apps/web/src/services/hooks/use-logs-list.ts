import { GetLogs } from "@/services/api/logs";
import type { IFindLogsQuery } from "@/services/dtos/log";
import { useQuery } from "@tanstack/react-query";

export const LOGS_LIST_QUERY_KEY = ["logs", "list"] as const;

export const useLogsList = (query: IFindLogsQuery) => {
  return useQuery({
    queryKey: [...LOGS_LIST_QUERY_KEY, query],
    queryFn: () => GetLogs(query),
    placeholderData: (previous) => previous,
  });
};
