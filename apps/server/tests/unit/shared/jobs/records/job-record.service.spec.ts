import { ErrorExceptionCode } from '@/common/exceptions/error.exception';
import {
  JOB_STATUS,
  JOB_TRIGGER_TYPE,
} from '@/shared/jobs/constants/job.constants';
import { JobRun } from '@/shared/jobs/records/entities/job-run.entity';
import { JobRecordService } from '@/shared/jobs/records/job-record.service';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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
  run.bullJobId = null;
  run.createdBy = null;
  run.createdAt = new Date('2026-07-14T00:00:00.000Z');
  Object.assign(run, overrides);
  return run;
};

const createUpdateQueryBuilder = (affected = 1) => {
  const queryBuilder = {
    update: vi.fn(() => queryBuilder),
    set: vi.fn(() => queryBuilder),
    where: vi.fn(() => queryBuilder),
    andWhere: vi.fn(() => queryBuilder),
    execute: vi.fn(() => Promise.resolve({ affected })),
  };
  return queryBuilder;
};

const createService = () => {
  const repository = {
    create: vi.fn((value: Partial<JobRun>) =>
      Object.assign(new JobRun(), value),
    ),
    createQueryBuilder: vi.fn(),
    save: vi.fn((value: JobRun) => Promise.resolve(value)),
    update: vi.fn(() => Promise.resolve({ affected: 1 })),
    findOneBy: vi.fn(),
    findAndCount: vi.fn(),
  };

  const service = new JobRecordService(repository as never);
  return { service, repository };
};

describe('JobRecordService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create queued job run', async () => {
    const { service, repository } = createService();

    const run = await service.createQueued({
      name: 'export-report',
      queueName: 'default',
      payload: { title: 'report' },
      maxAttempts: 1,
      triggerType: JOB_TRIGGER_TYPE.MANUAL,
    });

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'export-report',
        status: JOB_STATUS.QUEUED,
        progress: 0,
      }),
    );
    expect(repository.save).toHaveBeenCalled();
    expect(run.name).toBe('export-report');
  });

  it('should normalize progress into 0-100 range', async () => {
    const { service, repository } = createService();
    const queryBuilder = createUpdateQueryBuilder(1);
    repository.createQueryBuilder.mockReturnValue(queryBuilder);

    await service.updateProgress('job-1', 150);
    expect(queryBuilder.set).toHaveBeenCalledWith({
      progress: 100,
      status: JOB_STATUS.ACTIVE,
    });

    await service.updateProgress('job-1', -20);
    expect(queryBuilder.set).toHaveBeenCalledWith({
      progress: 0,
      status: JOB_STATUS.ACTIVE,
    });
  });

  it('should mark active with first startedAt and attemptsMade', async () => {
    const { service, repository } = createService();
    const queryBuilder = createUpdateQueryBuilder(1);
    repository.createQueryBuilder.mockReturnValue(queryBuilder);
    repository.findOneBy.mockResolvedValue(
      createRun({
        status: JOB_STATUS.ACTIVE,
        bullJobId: 'bull-1',
        attemptsMade: 2,
        startedAt: new Date(),
      }),
    );

    await expect(service.markActive('job-1', 'bull-1', 2)).resolves.toBe(true);
    expect(queryBuilder.set).toHaveBeenCalled();
  });

  it('should mark completed with result and attempts', async () => {
    const { service, repository } = createService();
    const run = createRun({ status: JOB_STATUS.ACTIVE, startedAt: new Date() });
    repository.findOneBy.mockResolvedValue(run);

    await service.markCompleted('job-1', { ok: true }, 3);

    expect(run.status).toBe(JOB_STATUS.COMPLETED);
    expect(run.progress).toBe(100);
    expect(run.result).toEqual({ ok: true });
    expect(run.attemptsMade).toBe(3);
    expect(run.errorMessage).toBeNull();
    expect(run.finishedAt).toBeInstanceOf(Date);
  });

  it('should mark final failure with truncated error message', async () => {
    const { service, repository } = createService();
    const longMessage = 'x'.repeat(2500);

    await service.markAttemptFailure('job-1', 3, new Error(longMessage), true);

    expect(repository.update).toHaveBeenCalledWith(
      'job-1',
      expect.objectContaining({
        status: JOB_STATUS.FAILED,
        attemptsMade: 3,
        errorMessage: expect.stringMatching(/^x{2000}\.\.\.$/) as string,
        finishedAt: expect.any(Date) as Date,
      }),
    );
  });

  it('should mark non-final failure as queued', async () => {
    const { service, repository } = createService();

    await service.markAttemptFailure('job-1', 1, 'temp fail', false);

    expect(repository.update).toHaveBeenCalledWith('job-1', {
      status: JOB_STATUS.QUEUED,
      attemptsMade: 1,
      errorMessage: 'temp fail',
    });
  });

  it('should throw when job is missing', async () => {
    const { service, repository } = createService();
    repository.findOneBy.mockResolvedValue(null);

    await expect(service.getEntityOrFail('missing')).rejects.toMatchObject({
      code: ErrorExceptionCode.JOB_NOT_FOUND,
    });
  });

  it('should list jobs with pagination and filters', async () => {
    const { service, repository } = createService();
    const run = createRun();
    repository.findAndCount.mockResolvedValue([[run], 1]);

    const result = await service.list({
      name: 'export-report',
      status: JOB_STATUS.QUEUED,
      page: 2,
      pageSize: 10,
    });

    expect(repository.findAndCount).toHaveBeenCalledWith({
      where: {
        name: 'export-report',
        status: JOB_STATUS.QUEUED,
      },
      order: { createdAt: 'DESC' },
      skip: 10,
      take: 10,
    });
    expect(result).toEqual({
      list: [expect.objectContaining({ id: 'job-1' })],
      total: 1,
      page: 2,
      pageSize: 10,
    });
  });

  it('should conditionally mark active and return true', async () => {
    const { service, repository } = createService();
    const queryBuilder = createUpdateQueryBuilder(1);
    repository.createQueryBuilder.mockReturnValue(queryBuilder);
    repository.findOneBy.mockResolvedValue(
      createRun({
        status: JOB_STATUS.ACTIVE,
        bullJobId: 'bull-1',
        attemptsMade: 2,
      }),
    );

    await expect(service.markActive('job-1', 'bull-1', 2)).resolves.toBe(true);
    expect(queryBuilder.update).toHaveBeenCalledWith(JobRun);
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'status IN (:...statuses)',
      { statuses: [JOB_STATUS.QUEUED, JOB_STATUS.DELAYED] },
    );
  });

  it('should return false when job is already cancelled during activation', async () => {
    const { service, repository } = createService();
    const queryBuilder = createUpdateQueryBuilder(0);
    repository.createQueryBuilder.mockReturnValue(queryBuilder);

    await expect(service.markActive('job-1', 'bull-1', 1)).resolves.toBe(false);
    expect(repository.findOneBy).not.toHaveBeenCalled();
  });
});
