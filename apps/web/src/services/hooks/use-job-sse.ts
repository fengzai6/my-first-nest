import { GetJob } from "@/services/api/jobs";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { SseState } from "fzkit/http-client";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import {
  createJobSseSubscriptionManager,
  type IJobSseSubscriptionManager,
} from "./job-sse";
import { getJobDetailQueryKey } from "./use-job-polling";

export const useJobSse = (
  jobId: string | null,
  jobIds: string[],
  enabled: boolean,
  onTerminal?: (jobId: string) => void,
) => {
  const [connectionState, setConnectionState] = useState<SseState>("closed");
  const [error, setError] = useState<Error | null>(null);
  const [lastEventAt, setLastEventAt] = useState<number | null>(null);

  const queryClient = useQueryClient();
  const managerRef = useRef<IJobSseSubscriptionManager | null>(null);
  const detailQuery = useQuery({
    queryKey: getJobDetailQueryKey(jobId ?? ""),
    queryFn: () => GetJob(jobId ?? ""),
    enabled: false,
  });

  const handleConnectionState = useEffectEvent((streamJobId: string, nextState: SseState) => {
    if (streamJobId !== jobId) return;
    setConnectionState(nextState);
  });

  const handleError = useEffectEvent((streamJobId: string, nextError: Error) => {
    if (streamJobId !== jobId) return;
    setError(nextError);
  });

  const handleEventReceived = useEffectEvent((streamJobId: string) => {
    if (streamJobId !== jobId) return;
    setLastEventAt(Date.now());
  });

  useEffect(() => {
    if (!enabled || !jobId) {
      setConnectionState("closed");
      setError(null);
      setLastEventAt(null);
      return;
    }

    setConnectionState("connecting");
    setError(null);
    setLastEventAt(null);
  }, [enabled, jobId]);

  useEffect(() => {
    if (!enabled) {
      managerRef.current?.close();
      managerRef.current = null;
      return;
    }

    const manager = createJobSseSubscriptionManager({
      queryClient,
      createCallbacks: (streamJobId) => ({
        onConnectionState: (state) =>
          handleConnectionState(streamJobId, state),
        onError: (nextError) => handleError(streamJobId, nextError),
        onEventReceived: () => handleEventReceived(streamJobId),
        onTerminal: () => onTerminal?.(streamJobId),
      }),
    });
    managerRef.current = manager;

    return () => {
      manager.close();
      managerRef.current = null;
    };
  }, [enabled, queryClient]);

  useEffect(() => {
    if (!enabled) return;

    const trackedJobIds = new Set(jobIds);
    if (jobId) {
      trackedJobIds.add(jobId);
    }
    managerRef.current?.sync([...trackedJobIds]);
  }, [enabled, jobId, jobIds]);

  const retry = () => {
    if (!jobId) return;

    setConnectionState("connecting");
    setError(null);
    managerRef.current?.retry(jobId);
  };

  return {
    data: detailQuery.data,
    error,
    isLoading: Boolean(jobId && enabled && !detailQuery.data && !error),
    isFetching:
      connectionState === "connecting" || connectionState === "retrying",
    connectionState,
    lastEventAt,
    retry,
  };
};
