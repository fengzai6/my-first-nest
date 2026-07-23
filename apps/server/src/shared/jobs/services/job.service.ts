import {
  ErrorException,
  ErrorExceptionCode,
} from '@/common/exceptions/error.exception';
import { Injectable, Logger } from '@nestjs/common';
import {
  DEFAULT_JOB_QUEUE,
  JOB_STATUS,
  JOB_TRIGGER_TYPE,
} from '../constants/job.constants';
import { JobQueueService } from '../queue/job-queue.service';
import { JobRecordService } from '../records/job-record.service';
import { JobRegistryService } from '../registry/job-registry.service';
import {
  JOB_CANCELLABLE_STATUSES,
  IJobRunView,
  IListJobsQuery,
  ISubmitJobInput,
} from '../types/job.types';

@Injectable()
export class JobService {
  private readonly logger = new Logger(JobService.name);

  constructor(
    private readonly registry: JobRegistryService,
    private readonly records: JobRecordService,
    private readonly queue: JobQueueService,
  ) {}

  async submit(input: ISubmitJobInput): Promise<IJobRunView> {
    if (!this.registry.has(input.name)) {
      throw new ErrorException(ErrorExceptionCode.JOB_HANDLER_NOT_FOUND);
    }

    const maxAttempts = input.attempts ?? 1;
    const delayMs = input.delayMs ?? 0;
    const status = delayMs > 0 ? JOB_STATUS.DELAYED : JOB_STATUS.QUEUED;

    const run = await this.records.createQueued({
      name: input.name,
      queueName: DEFAULT_JOB_QUEUE,
      payload: input.payload,
      maxAttempts,
      triggerType: input.triggerType ?? JOB_TRIGGER_TYPE.MANUAL,
      createdBy: input.createdBy,
      status,
    });

    try {
      const bullJob = await this.queue.enqueue(
        {
          jobId: run.id,
          name: input.name,
          payload: input.payload,
        },
        {
          jobId: run.id,
          delayMs,
          attempts: maxAttempts,
          backoffMs: input.backoffMs,
        },
      );

      if (bullJob.id) {
        await this.records.attachBullJobId(run.id, String(bullJob.id));
      }
    } catch (error) {
      await this.records.markAttemptFailure(run.id, 0, error, true);
      this.logger.error(
        `Failed to enqueue jobId=${run.id} name=${input.name}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }

    return this.records.getViewOrFail(run.id);
  }

  getById(jobId: string): Promise<IJobRunView> {
    return this.records.getViewOrFail(jobId);
  }

  list(query: IListJobsQuery) {
    return this.records.list(query);
  }

  async cancel(jobId: string): Promise<IJobRunView> {
    const run = await this.records.getEntityOrFail(jobId);

    if (!JOB_CANCELLABLE_STATUSES.includes(run.status)) {
      throw new ErrorException(ErrorExceptionCode.JOB_NOT_CANCELLABLE);
    }

    if (run.bullJobId) {
      await this.queue.remove(run.bullJobId);
    }

    const cancelled = await this.records.markCancelled(jobId);
    return this.records.toView(cancelled);
  }
}
