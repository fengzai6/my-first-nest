import {
  JOB_STATUS,
  JOB_SSE_EVENT,
  JOB_TRIGGER_TYPE,
} from '@/shared/jobs/constants/job.constants';
import {
  formatSseEvent,
  resolveJobSseEventName,
} from '@/shared/jobs/events/job-sse.util';
import { IJobRunView } from '@/shared/jobs/types/job.types';
import { describe, expect, it } from 'vitest';

const view: IJobRunView = {
  id: 'job-1',
  name: 'export-report',
  queueName: 'default',
  status: JOB_STATUS.COMPLETED,
  progress: 100,
  payload: { title: 'report' },
  result: { ok: true },
  errorMessage: null,
  attemptsMade: 1,
  maxAttempts: 1,
  triggerType: JOB_TRIGGER_TYPE.MANUAL,
  startedAt: new Date('2026-07-29T00:00:00.000Z'),
  finishedAt: new Date('2026-07-29T00:00:01.000Z'),
  createdAt: new Date('2026-07-29T00:00:00.000Z'),
};

describe('job-sse.util', () => {
  it('should resolve terminal status event names', () => {
    expect(resolveJobSseEventName(JOB_STATUS.COMPLETED)).toBe(
      JOB_SSE_EVENT.COMPLETED,
    );
    expect(resolveJobSseEventName(JOB_STATUS.FAILED)).toBe(
      JOB_SSE_EVENT.FAILED,
    );
    expect(resolveJobSseEventName(JOB_STATUS.CANCELLED)).toBe(
      JOB_SSE_EVENT.CANCELLED,
    );
    expect(resolveJobSseEventName(JOB_STATUS.ACTIVE)).toBe(
      JOB_SSE_EVENT.UPDATED,
    );
  });

  it('should format an event-stream chunk', () => {
    const chunk = formatSseEvent({
      id: '7',
      event: JOB_SSE_EVENT.COMPLETED,
      data: view,
    });

    expect(chunk).toContain('event: job.completed\n');
    expect(chunk).toContain('id: 7\n');
    expect(chunk).toContain('data: {');
    expect(chunk.endsWith('\n\n')).toBe(true);
  });
});
