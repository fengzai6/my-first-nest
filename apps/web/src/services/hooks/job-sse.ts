import http from "@/services/api/new-http";
import {
  JOB_SSE_EVENT,
  JOB_STATUS,
  JOB_TERMINAL_STATUSES,
  JOB_TRIGGER_TYPE,
  type IJobRun,
  type JobSseEventName,
} from "@/services/types/job";
import type { QueryClient } from "@tanstack/react-query";
import type { SseState, SseSubscription } from "fzkit/http-client";
import { getJobDetailQueryKey, syncJobToJobsListCache } from "./use-job-polling";

interface ISubscribeToJobSseOptions {
  jobId: string | null;
  enabled: boolean;
  queryClient: QueryClient;
  onConnectionState: (state: SseState) => void;
  onError: (error: Error) => void;
  onEventReceived: () => void;
  onTerminal?: () => void;
}

export interface IJobSseCallbacks {
  onConnectionState: (state: SseState) => void;
  onError: (error: Error) => void;
  onEventReceived: () => void;
  onTerminal?: () => void;
}

interface IJobSseSubscriptionManagerOptions {
  queryClient: QueryClient;
  createCallbacks: (jobId: string) => IJobSseCallbacks;
}

export interface IJobSseSubscriptionManager {
  sync: (jobIds: string[]) => void;
  retry: (jobId: string) => void;
  close: () => void;
}

const JOB_SSE_EVENT_NAMES = new Set<string>(Object.values(JOB_SSE_EVENT));
const JOB_STATUSES = new Set<string>(Object.values(JOB_STATUS));
const JOB_TRIGGER_TYPES = new Set<string>(Object.values(JOB_TRIGGER_TYPE));

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isNullableString = (value: unknown) =>
  value === null || typeof value === "string";

const isJobSseEventName = (value: string): value is JobSseEventName =>
  JOB_SSE_EVENT_NAMES.has(value);

const isJobRun = (value: unknown): value is IJobRun => {
  if (!isRecord(value)) return false;

  if (
    typeof value.id !== "string" ||
    typeof value.name !== "string" ||
    typeof value.queueName !== "string" ||
    typeof value.progress !== "number" ||
    typeof value.attemptsMade !== "number" ||
    typeof value.maxAttempts !== "number" ||
    typeof value.createdAt !== "string" ||
    typeof value.status !== "string" ||
    typeof value.triggerType !== "string"
  ) {
    return false;
  }

  if (!JOB_STATUSES.has(value.status) || !JOB_TRIGGER_TYPES.has(value.triggerType)) {
    return false;
  }

  if (
    ("errorMessage" in value && !isNullableString(value.errorMessage)) ||
    ("startedAt" in value && !isNullableString(value.startedAt)) ||
    ("finishedAt" in value && !isNullableString(value.finishedAt))
  ) {
    return false;
  }

  return true;
};

const isTerminalJob = (job: IJobRun) =>
  JOB_TERMINAL_STATUSES.includes(job.status);

export const subscribeToJobSse = ({
  jobId,
  enabled,
  queryClient,
  onConnectionState,
  onError,
  onEventReceived,
  onTerminal,
}: ISubscribeToJobSseOptions) => {
  if (!enabled || !jobId) return undefined;

  let disposed = false;
  let terminal = false;
  let receivedError = false;
  let receivedNonSnapshotEvent = false;

  const reportError = (error: Error) => {
    if (disposed || terminal || receivedError) return;

    receivedError = true;
    onError(error);
  };

  const subscription: SseSubscription = http.sse(`/jobs/${jobId}/events`, {
    maxRetries: 5,
    sequentialMessages: true,
    onOpen: () => {
      if (disposed) return;

      receivedNonSnapshotEvent = false;
      onConnectionState("open");
    },
    onRetry: () => {
      if (!disposed) onConnectionState("retrying");
    },
    onError: (error) => reportError(error),
    onMessage: (event) => {
      if (disposed || !isJobSseEventName(event.event)) return;
      if (event.event === JOB_SSE_EVENT.SNAPSHOT && receivedNonSnapshotEvent) {
        return;
      }

      let data: unknown;
      try {
        data = JSON.parse(event.data);
      } catch {
        reportError(new Error("任务 SSE 事件数据不是有效 JSON"));
        subscription.close();
        return;
      }

      if (!isJobRun(data)) {
        reportError(new Error("任务 SSE 事件数据格式无效"));
        subscription.close();
        return;
      }

      if (event.event !== JOB_SSE_EVENT.SNAPSHOT) {
        receivedNonSnapshotEvent = true;
      }

      queryClient.setQueryData(getJobDetailQueryKey(jobId), data);
      syncJobToJobsListCache(queryClient, data);
      onEventReceived();

      if (isTerminalJob(data)) {
        terminal = true;
        subscription.close();
        onTerminal?.();
      }
    },
    onClose: (reason) => {
      if (disposed) return;

      onConnectionState("closed");
      if (!terminal && reason !== "manual" && reason !== "signal") {
        reportError(new Error(`任务 SSE 订阅已关闭：${reason}`));
      }
    },
  });

  return () => {
    disposed = true;
    subscription.close();
  };
};

export const createJobSseSubscriptionManager = ({
  queryClient,
  createCallbacks,
}: IJobSseSubscriptionManagerOptions): IJobSseSubscriptionManager => {
  const cleanups = new Map<string, () => void>();
  const terminalJobIds = new Set<string>();

  const start = (jobId: string) => {
    const callbacks = createCallbacks(jobId);
    const cleanup = subscribeToJobSse({
      jobId,
      enabled: true,
      queryClient,
      ...callbacks,
      onTerminal: () => {
        terminalJobIds.add(jobId);
        callbacks.onTerminal?.();
      },
    });

    if (cleanup) {
      cleanups.set(jobId, cleanup);
    }
  };

  const close = () => {
    for (const cleanup of cleanups.values()) {
      cleanup();
    }
    cleanups.clear();
    terminalJobIds.clear();
  };

  return {
    sync: (jobIds) => {
      const nextJobIds = new Set(jobIds);

      for (const [jobId, cleanup] of cleanups) {
        if (!nextJobIds.has(jobId)) {
          cleanup();
          cleanups.delete(jobId);
          terminalJobIds.delete(jobId);
        }
      }

      for (const jobId of nextJobIds) {
        if (cleanups.has(jobId) || terminalJobIds.has(jobId)) continue;
        start(jobId);
      }
    },
    retry: (jobId) => {
      cleanups.get(jobId)?.();
      cleanups.delete(jobId);
      terminalJobIds.delete(jobId);
      start(jobId);
    },
    close,
  };
};
