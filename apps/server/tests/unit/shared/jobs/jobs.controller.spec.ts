import {
  JOB_STATUS,
  JOB_SSE_EVENT,
  JOB_TRIGGER_TYPE,
} from '@/shared/jobs/constants/job.constants';
import { JobEventsService } from '@/shared/jobs/events/job-events.service';
import { JobsController } from '@/shared/jobs/jobs.controller';
import { JobService } from '@/shared/jobs/services/job.service';
import { IJobRunView, IJobSseEvent } from '@/shared/jobs/types/job.types';
import { Request, Response } from 'express';
import { Subject } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const createView = (status = JOB_STATUS.ACTIVE): IJobRunView => ({
  id: 'job-1',
  name: 'export-report',
  queueName: 'default',
  status,
  progress: status === JOB_STATUS.COMPLETED ? 100 : 50,
  payload: { title: 'report' },
  result: status === JOB_STATUS.COMPLETED ? { ok: true } : undefined,
  errorMessage: null,
  attemptsMade: 1,
  maxAttempts: 1,
  triggerType: JOB_TRIGGER_TYPE.MANUAL,
  startedAt: new Date('2026-07-29T00:00:00.000Z'),
  finishedAt:
    status === JOB_STATUS.COMPLETED
      ? new Date('2026-07-29T00:00:01.000Z')
      : null,
  createdAt: new Date('2026-07-29T00:00:00.000Z'),
});

const createController = () => {
  const jobService = {
    list: vi.fn(),
    getById: vi.fn(),
    cancel: vi.fn(),
  };
  const events = {
    subscribe: vi.fn(),
  };
  const controller = new JobsController(
    jobService as unknown as JobService,
    events as unknown as JobEventsService,
  );

  return { controller, jobService, events };
};

const createResponse = () => {
  return {
    setHeader: vi.fn(),
    flushHeaders: vi.fn(),
    write: vi.fn(),
    end: vi.fn(),
  } as unknown as Response;
};

const createRequest = () => {
  const handlers = new Map<string, () => void>();
  const request = {
    on: vi.fn((event: string, handler: () => void) => {
      handlers.set(event, handler);
    }),
  } as unknown as Request;

  return { request, handlers };
};

describe('JobsController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should stream snapshot and close after terminal event', async () => {
    const { controller, jobService, events } = createController();
    const subject = new Subject<IJobSseEvent>();
    const response = createResponse();
    const { request } = createRequest();

    jobService.getById.mockResolvedValue(createView());
    events.subscribe.mockReturnValue(subject.asObservable());

    await controller.getEvents('job-1', request, response);

    expect(response.setHeader).toHaveBeenCalledWith(
      'Content-Type',
      'text/event-stream',
    );
    expect(response.write).toHaveBeenCalledWith(
      expect.stringContaining('event: job.snapshot'),
    );

    subject.next({
      id: '1',
      event: JOB_SSE_EVENT.UPDATED,
      data: createView(),
    });
    expect(response.write).toHaveBeenCalledWith(
      expect.stringContaining('event: job.updated'),
    );

    subject.next({
      id: '2',
      event: JOB_SSE_EVENT.COMPLETED,
      data: createView(JOB_STATUS.COMPLETED),
    });

    expect(response.write).toHaveBeenCalledWith(
      expect.stringContaining('event: job.completed'),
    );
    expect(response.end).toHaveBeenCalledTimes(1);
  });
});
