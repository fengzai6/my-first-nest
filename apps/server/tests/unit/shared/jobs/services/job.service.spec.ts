import { ErrorExceptionCode } from '@/common/exceptions/error.exception';
import {
  JOB_STATUS,
  JOB_TRIGGER_TYPE,
} from '@/shared/jobs/constants/job.constants';
import { JobQueueService } from '@/shared/jobs/queue/job-queue.service';
import { JobRecordService } from '@/shared/jobs/records/job-record.service';
import { JobRun } from '@/shared/jobs/records/entities/job-run.entity';
import { JobRegistryService } from '@/shared/jobs/registry/job-registry.service';
import { JobService } from '@/shared/jobs/services/job.service';
import { IJobRunView } from '@/shared/jobs/types/job.types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const createView = (overrides: Partial<IJobRunView> = {}): IJobRunView => ({
  id: 'job-1',
  name: 'export-report',
  queueName: 'default',
  status: JOB_STATUS.QUEUED,
  progress: 0,
  payload: { title: 'report' },
  result: undefined,
  errorMessage: null,
  attemptsMade: 0,
  maxAttempts: 1,
  triggerType: JOB_TRIGGER_TYPE.MANUAL,
  startedAt: null,
  finishedAt: null,
  createdAt: new Date('2026-07-14T00:00:00.000Z'),
  ...overrides,
});

const createRun = (overrides: Partial<JobRun> = {}) => {
  const run = new JobRun();
  run.id = 'job-1';
  run.name = 'export-report';
  run.queueName = 'default';
  run.status = JOB_STATUS.QUEUED;
  run.progress = 0;
  run.payload = { title: 'report' };
  run.result = null;
  run.errorMessage = null;
  run.attemptsMade = 0;
  run.maxAttempts = 1;
  run.triggerType = JOB_TRIGGER_TYPE.MANUAL;
  run.startedAt = null;
  run.finishedAt = null;
  run.bullJobId = 'bull-1';
  run.createdAt = new Date('2026-07-14T00:00:00.000Z');
  Object.assign(run, overrides);
  return run;
};

const createService = () => {
  const registry = {
    has: vi.fn(),
    get: vi.fn(),
  };
  const records = {
    createQueued: vi.fn(),
    attachBullJobId: vi.fn(),
    getViewOrFail: vi.fn(),
    getEntityOrFail: vi.fn(),
    markAttemptFailure: vi.fn(),
    markCancelled: vi.fn(),
    markCancelledIfCancellable: vi.fn(),
    toView: vi.fn(),
    list: vi.fn(),
  };
  const queue = {
    enqueue: vi.fn(),
    remove: vi.fn(),
  };

  const service = new JobService(
    registry as unknown as JobRegistryService,
    records as unknown as JobRecordService,
    queue as unknown as JobQueueService,
  );

  return { service, registry, records, queue };
};

describe('JobService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should reject unknown handler name on submit', async () => {
    const { service, registry } = createService();
    registry.has.mockReturnValue(false);

    await expect(
      service.submit({ name: 'missing-handler' }),
    ).rejects.toMatchObject({
      code: ErrorExceptionCode.JOB_HANDLER_NOT_FOUND,
    });
  });

  it('should create record, enqueue job and return view', async () => {
    const { service, registry, records, queue } = createService();
    const run = createRun();
    const view = createView();

    registry.has.mockReturnValue(true);
    records.createQueued.mockResolvedValue(run);
    queue.enqueue.mockResolvedValue({ id: 'bull-1' });
    records.getViewOrFail.mockResolvedValue(view);

    const result = await service.submit({
      name: 'export-report',
      payload: { title: 'report' },
      attempts: 1,
    });

    expect(records.createQueued).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'export-report',
        status: JOB_STATUS.QUEUED,
        maxAttempts: 1,
      }),
    );
    expect(queue.enqueue).toHaveBeenCalledWith(
      {
        jobId: 'job-1',
        name: 'export-report',
        payload: { title: 'report' },
      },
      expect.objectContaining({
        jobId: 'job-1',
        attempts: 1,
      }),
    );
    expect(records.attachBullJobId).toHaveBeenCalledWith('job-1', 'bull-1');
    expect(result).toBe(view);
  });

  it('should create delayed record when delayMs > 0', async () => {
    const { service, registry, records, queue } = createService();
    const run = createRun({ status: JOB_STATUS.DELAYED });
    const view = createView({ status: JOB_STATUS.DELAYED });

    registry.has.mockReturnValue(true);
    records.createQueued.mockResolvedValue(run);
    queue.enqueue.mockResolvedValue({ id: 'bull-2' });
    records.getViewOrFail.mockResolvedValue(view);

    await service.submit({
      name: 'export-report',
      delayMs: 5000,
    });

    expect(records.createQueued).toHaveBeenCalledWith(
      expect.objectContaining({
        status: JOB_STATUS.DELAYED,
      }),
    );
    expect(queue.enqueue).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ delayMs: 5000 }),
    );
  });

  it('should mark failed when enqueue throws', async () => {
    const { service, registry, records, queue } = createService();
    const run = createRun();
    const error = new Error('redis down');

    registry.has.mockReturnValue(true);
    records.createQueued.mockResolvedValue(run);
    queue.enqueue.mockRejectedValue(error);

    await expect(service.submit({ name: 'export-report' })).rejects.toThrow(
      'redis down',
    );

    expect(records.markAttemptFailure).toHaveBeenCalledWith(
      'job-1',
      0,
      error,
      true,
    );
  });

  it('should cancel queued job', async () => {
    const { service, records, queue } = createService();
    const run = createRun({ status: JOB_STATUS.QUEUED, bullJobId: 'bull-1' });
    const cancelled = createRun({
      status: JOB_STATUS.CANCELLED,
      bullJobId: 'bull-1',
    });
    const view = createView({ status: JOB_STATUS.CANCELLED });

    records.getEntityOrFail.mockResolvedValue(run);
    queue.remove.mockResolvedValue(true);
    records.markCancelledIfCancellable.mockResolvedValue(cancelled);
    records.toView.mockReturnValue(view);

    const result = await service.cancel('job-1');

    expect(queue.remove).toHaveBeenCalledWith('bull-1');
    expect(records.markCancelledIfCancellable).toHaveBeenCalledWith('job-1');
    expect(result.status).toBe(JOB_STATUS.CANCELLED);
  });

  it('should reject cancel for active job', async () => {
    const { service, records } = createService();
    records.getEntityOrFail.mockResolvedValue(
      createRun({ status: JOB_STATUS.ACTIVE }),
    );
    records.markCancelledIfCancellable.mockResolvedValue(null);

    await expect(service.cancel('job-1')).rejects.toMatchObject({
      code: ErrorExceptionCode.JOB_NOT_CANCELLABLE,
    });
  });

  it('should not mark failed when attachBullJobId fails after enqueue', async () => {
    const { service, registry, records, queue } = createService();
    const run = createRun();
    const view = createView();
    const error = new Error('db write failed');

    registry.has.mockReturnValue(true);
    records.createQueued.mockResolvedValue(run);
    queue.enqueue.mockResolvedValue({ id: 'bull-1' });
    records.attachBullJobId.mockRejectedValue(error);
    records.getViewOrFail.mockResolvedValue(view);

    const result = await service.submit({
      name: 'export-report',
      payload: { title: 'report' },
    });

    expect(records.markAttemptFailure).not.toHaveBeenCalled();
    expect(result).toBe(view);
  });

  it('should still cancel when queue.remove throws', async () => {
    const { service, records, queue } = createService();
    const run = createRun({ status: JOB_STATUS.QUEUED, bullJobId: 'bull-1' });
    const cancelled = createRun({
      status: JOB_STATUS.CANCELLED,
      bullJobId: 'bull-1',
    });
    const view = createView({ status: JOB_STATUS.CANCELLED });

    records.getEntityOrFail.mockResolvedValue(run);
    queue.remove.mockRejectedValue(new Error('already active'));
    records.markCancelledIfCancellable.mockResolvedValue(cancelled);
    records.toView.mockReturnValue(view);

    const result = await service.cancel('job-1');

    expect(queue.remove).toHaveBeenCalledWith('bull-1');
    expect(records.markCancelledIfCancellable).toHaveBeenCalledWith('job-1');
    expect(result.status).toBe(JOB_STATUS.CANCELLED);
  });
});
