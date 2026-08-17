import {
  JOB_SSE_EVENT,
  JOB_STATUS,
  JobStatus,
} from '../constants/job.constants';
import { IJobSseEvent } from '../types/job.types';

export const resolveJobSseEventName = (status: JobStatus) => {
  if (status === JOB_STATUS.COMPLETED) return JOB_SSE_EVENT.COMPLETED;
  if (status === JOB_STATUS.FAILED) return JOB_SSE_EVENT.FAILED;
  if (status === JOB_STATUS.CANCELLED) return JOB_SSE_EVENT.CANCELLED;
  return JOB_SSE_EVENT.UPDATED;
};

export const formatSseEvent = (event: IJobSseEvent) => {
  return [
    `event: ${event.event}`,
    `id: ${event.id}`,
    `data: ${JSON.stringify(event.data)}`,
    '',
    '',
  ].join('\n');
};
