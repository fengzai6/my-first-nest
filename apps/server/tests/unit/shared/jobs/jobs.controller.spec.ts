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

const createView = (
  status: IJobRunView['status'] = JOB_STATUS.ACTIVE,
): IJobRunView => ({
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
  const setHeader = vi.fn();
  const flushHeaders = vi.fn();
  const write = vi.fn();
  const end = vi.fn();
  const response = {
    setHeader,
    flushHeaders,
    write,
    end,
  } as unknown as Response;

  return { response, setHeader, write, end };
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
    const { response, setHeader, write, end } = createResponse();
    const { request } = createRequest();

    jobService.getById.mockResolvedValue(createView());
    events.subscribe.mockReturnValue(subject.asObservable());

    await controller.getEvents('job-1', request, response);

    expect(setHeader).toHaveBeenCalledWith('Content-Type', 'text/event-stream');
    expect(write).toHaveBeenCalledWith(
      expect.stringContaining('event: job.snapshot'),
    );

    subject.next({
      id: '1',
      event: JOB_SSE_EVENT.UPDATED,
      data: createView(),
    });
    expect(write).toHaveBeenCalledWith(
      expect.stringContaining('event: job.updated'),
    );

    subject.next({
      id: '2',
      event: JOB_SSE_EVENT.COMPLETED,
      data: createView(JOB_STATUS.COMPLETED),
    });

    expect(write).toHaveBeenCalledWith(
      expect.stringContaining('event: job.completed'),
    );
    expect(end).toHaveBeenCalledTimes(1);
  });

  it('should subscribe before sending snapshot so mid-read events are not lost', async () => {
    const { controller, jobService, events } = createController();
    const subject = new Subject<IJobSseEvent>();
    const { response, write } = createResponse();
    const { request } = createRequest();
    const writeOrder: string[] = [];

    jobService.getById.mockImplementation(() => {
      subject.next({
        id: '1',
        event: JOB_SSE_EVENT.UPDATED,
        data: createView(),
      });
      return createView();
    });
    events.subscribe.mockReturnValue(subject.asObservable());
    write.mockImplementation((chunk: string) => {
      writeOrder.push(chunk);
      return true;
    });

    await controller.getEvents('job-1', request, response);

    expect(events.subscribe).toHaveBeenCalledWith('job-1');
    expect(writeOrder[0]).toContain('event: job.updated');
    expect(writeOrder[1]).toContain('event: job.snapshot');
  });
});
