import {
  ErrorException,
  ErrorExceptionCode,
} from '@/common/exceptions/error.exception';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { JobEventsService } from '../events/job-events.service';
import { resolveJobSseEventName } from '../events/job-sse.util';
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
    private readonly jobEvents: JobEventsService,
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

  /**
   * 仅当任务仍可执行（queued/delayed）时激活。
   * 返回 false 表示取消或其他终态已抢先，worker 应跳过执行。
   */
  async markActive(
    jobId: string,
    bullJobId?: string,
    attemptsMade?: number,
  ): Promise<boolean> {
    const result = await this.jobRunRepository
      .createQueryBuilder()
      .update(JobRun)
      .set({
        status: JOB_STATUS.ACTIVE,
        bullJobId: bullJobId ?? undefined,
        attemptsMade:
          typeof attemptsMade === 'number' ? attemptsMade : undefined,
        startedAt: () => 'COALESCE(started_at, NOW())',
      })
      .where('id = :jobId', { jobId })
      .andWhere('status IN (:...statuses)', {
        statuses: [JOB_STATUS.QUEUED, JOB_STATUS.DELAYED],
      })
      .execute();

    const affected = Boolean(result.affected);
    if (affected) {
      await this.publishJobEvent(jobId);
    }

    return affected;
  }

  async updateProgress(jobId: string, progress: number): Promise<void> {
    const normalized = Math.max(0, Math.min(100, Math.round(progress)));
    const result = await this.jobRunRepository
      .createQueryBuilder()
      .update(JobRun)
      .set({
        progress: normalized,
        status: JOB_STATUS.ACTIVE,
      })
      .where('id = :jobId', { jobId })
      .andWhere('status = :status', { status: JOB_STATUS.ACTIVE })
      .execute();

    if (result.affected) {
      await this.publishJobEvent(jobId);
    }
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
    this.publishJobRunEvent(run);
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
      await this.publishJobEvent(jobId);
      return;
    }

    await this.jobRunRepository.update(jobId, {
      status: JOB_STATUS.QUEUED,
      attemptsMade,
      errorMessage,
    });
    await this.publishJobEvent(jobId);
  }

  async markCancelled(jobId: string): Promise<JobRun> {
    const run = await this.getEntityOrFail(jobId);
    run.status = JOB_STATUS.CANCELLED;
    run.finishedAt = new Date();
    const saved = await this.jobRunRepository.save(run);
    this.publishJobRunEvent(saved);
    return saved;
  }

  /**
   * 仅当任务仍处于可取消状态时落库为 cancelled。
   * 返回 null 表示当前已不可取消（例如已被 worker 取走）。
   */
  async markCancelledIfCancellable(jobId: string): Promise<JobRun | null> {
    const result = await this.jobRunRepository
      .createQueryBuilder()
      .update(JobRun)
      .set({
        status: JOB_STATUS.CANCELLED,
        finishedAt: new Date(),
      })
      .where('id = :jobId', { jobId })
      .andWhere('status IN (:...statuses)', {
        statuses: [JOB_STATUS.QUEUED, JOB_STATUS.DELAYED],
      })
      .execute();

    if (!result.affected) {
      return null;
    }

    const cancelled = await this.getEntityOrFail(jobId);
    this.publishJobRunEvent(cancelled);
    return cancelled;
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

  private async publishJobEvent(jobId: string): Promise<void> {
    const run = await this.getEntityOrFail(jobId);
    this.publishJobRunEvent(run);
  }

  private publishJobRunEvent(run: JobRun): void {
    const view = this.toView(run);
    this.jobEvents.publish({
      event: resolveJobSseEventName(view.status),
      data: view,
    });
  }
}
