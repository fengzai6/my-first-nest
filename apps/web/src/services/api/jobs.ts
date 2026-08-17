import type { IFindJobsQuery } from "../dtos/job";
import type { IJobRun, IJobsPage } from "../types/job";
import http from "./new-http";

export const GetJobs = async (params?: IFindJobsQuery) => {
  const res = await http.get<IJobsPage>("/jobs", { params });

  return res.data;
};

export const GetJob = async (id: string) => {
  const res = await http.get<IJobRun>(`/jobs/${id}`);

  return res.data;
};

export const CancelJob = async (id: string) => {
  const res = await http.post<IJobRun>(`/jobs/${id}/cancel`);

  return res.data;
};
