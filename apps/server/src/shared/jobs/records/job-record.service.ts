import {
  ErrorException,
  ErrorExceptionCode,
} from '@/common/exceptions/error.exception';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import {
  JOB_STATUS,
  JobStatus,
  JobTriggerType,
} from '../constants/job.constants';
import { IJobRunView, IListJobsQuery } from '../types/job.types';
import { JobRun } from './entities/job-run.entity';

const MAX_ERROR_MESSAGE_LENGTH = 2000;

@Injectable()
export class JobRecordService {
  constructor(
    @InjectRepository(JobRun)
    private readonly jobRunRepository: Repository<JobRun>,
  ) {}

  toView(run: JobRun): IJobRunView {
    return {
      id: run.id,
      name: run.name,
      queueName: run.queueName,
      status: run.status,
      progress: run.progress,
      payload: run.payload ?? undefined,
      result: run.result ?? undefined,
      errorMessage: run.errorMessage,
      attemptsMade: run.attemptsMade,
      maxAttempts: run.maxAttempts,
      triggerType: run.triggerType,
      startedAt: run.startedAt,
      finishedAt: run.finishedAt,
      createdAt: run.createdAt,
    };
  }

  async createQueued(input: {
    name: string;
    queueName: string;
    payload?: unknown;
    maxAttempts: number;
    triggerType: JobTriggerType;
    createdBy?: string;
    status?: JobStatus;
  }): Promise<JobRun> {
    const run = this.jobRunRepository.create({
      name: input.name,
      queueName: input.queueName,
      payload: (input.payload as object | undefined) ?? null,
      maxAttempts: input.maxAttempts,
      triggerType: input.triggerType,
      createdBy: input.createdBy ?? null,
      status: input.status ?? JOB_STATUS.QUEUED,
      progress: 0,
      attemptsMade: 0,
      bullJobId: null,
      result: null,
      errorMessage: null,
      startedAt: null,
      finishedAt: null,
    });

    return this.jobRunRepository.save(run);
  }

  async attachBullJobId(jobId: string, bullJobId: string): Promise<void> {
    await this.jobRunRepository.update(jobId, { bullJobId });
  }

  async markActive(
    jobId: string,
    bullJobId?: string,
    attemptsMade?: number,
  ): Promise<void> {
    const run = await this.getEntityOrFail(jobId);
    run.status = JOB_STATUS.ACTIVE;
    if (bullJobId) run.bullJobId = bullJobId;
    if (typeof attemptsMade === 'number') run.attemptsMade = attemptsMade;
    if (!run.startedAt) run.startedAt = new Date();
    await this.jobRunRepository.save(run);
  }

  async updateProgress(jobId: string, progress: number): Promise<void> {
    const normalized = Math.max(0, Math.min(100, Math.round(progress)));
    await this.jobRunRepository.update(jobId, {
      progress: normalized,
      status: JOB_STATUS.ACTIVE,
    });
  }

  async markCompleted(
    jobId: string,
    result: unknown,
    attemptsMade?: number,
  ): Promise<void> {
    const run = await this.getEntityOrFail(jobId);
    run.status = JOB_STATUS.COMPLETED;
    run.progress = 100;
    run.result = (result as object | undefined) ?? null;
    run.errorMessage = null;
    if (typeof attemptsMade === 'number') run.attemptsMade = attemptsMade;
    run.finishedAt = new Date();
    await this.jobRunRepository.save(run);
  }

  async markAttemptFailure(
    jobId: string,
    attemptsMade: number,
    error: unknown,
    isFinal: boolean,
  ): Promise<void> {
    const errorMessage = this.stringifyError(error);
    if (isFinal) {
      await this.jobRunRepository.update(jobId, {
        status: JOB_STATUS.FAILED,
        attemptsMade,
        errorMessage,
        finishedAt: new Date(),
      });
      return;
    }

    await this.jobRunRepository.update(jobId, {
      status: JOB_STATUS.QUEUED,
      attemptsMade,
      errorMessage,
    });
  }

  async markCancelled(jobId: string): Promise<JobRun> {
    const run = await this.getEntityOrFail(jobId);
    run.status = JOB_STATUS.CANCELLED;
    run.finishedAt = new Date();
    return this.jobRunRepository.save(run);
  }

  async getEntityOrFail(jobId: string): Promise<JobRun> {
    const run = await this.jobRunRepository.findOneBy({ id: jobId });
    if (!run) {
      throw new ErrorException(ErrorExceptionCode.JOB_NOT_FOUND);
    }
    return run;
  }

  async getViewOrFail(jobId: string): Promise<IJobRunView> {
    return this.toView(await this.getEntityOrFail(jobId));
  }

  async list(query: IListJobsQuery) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const where: FindOptionsWhere<JobRun> = {};
    if (query.name) where.name = query.name;
    if (query.status) where.status = query.status;

    const [list, total] = await this.jobRunRepository.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    return {
      list: list.map((item) => this.toView(item)),
      total,
      page,
      pageSize,
    };
  }

  private stringifyError(error: unknown): string {
    let message = 'Unknown error';
    if (error instanceof Error) message = error.message;
    else if (typeof error === 'string') message = error;
    else {
      try {
        message = JSON.stringify(error);
      } catch {
        message = String(error);
      }
    }

    if (message.length > MAX_ERROR_MESSAGE_LENGTH) {
      return `${message.slice(0, MAX_ERROR_MESSAGE_LENGTH)}...`;
    }
    return message;
  }
}
