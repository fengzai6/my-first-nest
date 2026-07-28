import {
  JOB_STATUS,
  JobStatus,
  JobTriggerType,
} from '../constants/job.constants';

export interface IJobContext<TPayload = unknown> {
  jobId: string;
  bullJobId?: string;
  name: string;
  payload: TPayload;
  attemptsMade: number;
  maxAttempts: number;
  updateProgress: (progress: number) => Promise<void>;
}

export interface IJobHandler<TPayload = unknown, TResult = unknown> {
  readonly name: string;
  handle(ctx: IJobContext<TPayload>): Promise<TResult>;
}

export interface ISubmitJobInput {
  name: string;
  payload?: unknown;
  delayMs?: number;
  attempts?: number;
  backoffMs?: number;
  triggerType?: JobTriggerType;
  createdBy?: string;
}

export interface IJobRunView {
  id: string;
  name: string;
  queueName: string;
  status: JobStatus;
  progress: number;
  payload?: unknown;
  result?: unknown;
  errorMessage?: string | null;
  attemptsMade: number;
  maxAttempts: number;
  triggerType: JobTriggerType;
  startedAt?: Date | null;
  finishedAt?: Date | null;
  createdAt: Date;
}

export interface IListJobsQuery {
  name?: string;
  status?: JobStatus;
  page?: number;
  pageSize?: number;
}

export interface IBullJobData {
  jobId: string;
  name: string;
  payload?: unknown;
}

export const JOB_TERMINAL_STATUSES: readonly JobStatus[] = [
  JOB_STATUS.COMPLETED,
  JOB_STATUS.FAILED,
  JOB_STATUS.CANCELLED,
] as const;

export const JOB_CANCELLABLE_STATUSES: readonly JobStatus[] = [
  JOB_STATUS.QUEUED,
  JOB_STATUS.DELAYED,
] as const;
