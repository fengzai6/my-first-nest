import { JOB_SSE_EVENT } from '@/shared/jobs/constants/job.constants';
import { JobEventsService } from '@/shared/jobs/events/job-events.service';
import { IJobRunView } from '@/shared/jobs/types/job.types';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  JOB_STATUS,
  JOB_TRIGGER_TYPE,
} from '@/shared/jobs/constants/job.constants';

const createView = (id: string): IJobRunView => ({
  id,
  name: 'export-report',
  queueName: 'default',
  status: JOB_STATUS.ACTIVE,
  progress: 50,
  payload: { title: 'report' },
  result: undefined,
  errorMessage: null,
  attemptsMade: 1,
  maxAttempts: 1,
  triggerType: JOB_TRIGGER_TYPE.MANUAL,
  startedAt: new Date('2026-07-29T00:00:00.000Z'),
  finishedAt: null,
  createdAt: new Date('2026-07-29T00:00:00.000Z'),
});

describe('JobEventsService', () => {
  let service: JobEventsService;

  beforeEach(() => {
    service = new JobEventsService();
  });

  it('should publish events only to subscribers of the same job', () => {
    const received: string[] = [];

    const subscription = service.subscribe('job-1').subscribe((event) => {
      received.push(event.data.id);
    });

    service.publish({ event: JOB_SSE_EVENT.UPDATED, data: createView('job-2') });
    service.publish({ event: JOB_SSE_EVENT.UPDATED, data: createView('job-1') });

    expect(received).toEqual(['job-1']);
    subscription.unsubscribe();
  });

  it('should assign increasing event ids', () => {
    const first = service.publish({
      event: JOB_SSE_EVENT.SNAPSHOT,
      data: createView('job-1'),
    });
    const second = service.publish({
      event: JOB_SSE_EVENT.UPDATED,
      data: createView('job-1'),
    });

    expect(first.id).toBe('1');
    expect(second.id).toBe('2');
  });

  it('should stop delivering events after unsubscribe', () => {
    const received: string[] = [];
    const subscription = service.subscribe('job-1').subscribe((event) => {
      received.push(event.id);
    });

    service.publish({ event: JOB_SSE_EVENT.UPDATED, data: createView('job-1') });
    subscription.unsubscribe();
    service.publish({ event: JOB_SSE_EVENT.UPDATED, data: createView('job-1') });

    expect(received).toEqual(['1']);
  });
});
