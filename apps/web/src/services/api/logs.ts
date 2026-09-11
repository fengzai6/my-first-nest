import type { IFindLogsQuery } from "../dtos/log";
import type { ILogRecord, ILogsPage } from "../types/log";
import http from "./new-http";

export const GetLogs = async (params: IFindLogsQuery) => {
  const res = await http.get<ILogsPage>("/logs", { params });

  return res.data;
};

export const GetLog = async (id: string) => {
  const res = await http.get<ILogRecord>(`/logs/${id}`);

  return res.data;
};
