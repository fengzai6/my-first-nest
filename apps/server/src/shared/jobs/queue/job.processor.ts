import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { DEFAULT_JOB_QUEUE } from '../constants/job.constants';
import { JobRecordService } from '../records/job-record.service';
import { JobRegistryService } from '../registry/job-registry.service';
import { IBullJobData, IJobContext } from '../types/job.types';

@Processor(DEFAULT_JOB_QUEUE)
export class JobProcessor extends WorkerHost {
  private readonly logger = new Logger(JobProcessor.name);

  constructor(
    private readonly registry: JobRegistryService,
    private readonly records: JobRecordService,
  ) {
    super();
  }

  async process(job: Job<IBullJobData>): Promise<unknown> {
    const { jobId, name, payload } = job.data;
    const maxAttempts = job.opts.attempts ?? 1;
    const attemptsMade = job.attemptsMade + 1;

    this.logger.log(
      `Processing jobId=${jobId} name=${name} bullJobId=${job.id} attempt=${attemptsMade}/${maxAttempts}`,
    );

    await this.records.markActive(jobId, job.id, attemptsMade);

    const handler = this.registry.get(name);

    const ctx: IJobContext = {
      jobId,
      bullJobId: job.id,
      name,
      payload,
      attemptsMade,
      maxAttempts,
      updateProgress: async (progress: number) => {
        await this.records.updateProgress(jobId, progress);
        await job.updateProgress(progress);
      },
    };

    try {
      const result = await handler.handle(ctx);
      await this.records.markCompleted(jobId, result, attemptsMade);
      this.logger.log(`Completed jobId=${jobId} name=${name}`);
      return result;
    } catch (error) {
      const isFinal = attemptsMade >= maxAttempts;
      await this.records.markAttemptFailure(
        jobId,
        attemptsMade,
        error,
        isFinal,
      );

      this.logger.error(
        `Failed jobId=${jobId} name=${name} attempt=${attemptsMade}/${maxAttempts} final=${isFinal}`,
        error instanceof Error ? error.stack : undefined,
      );

      throw error;
    }
  }
}
