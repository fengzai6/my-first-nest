import { LOG_CATEGORY } from '@/shared/log/constants/log.constants';
import { LoggerService } from '@/shared/log/logger.service';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { DEFAULT_JOB_QUEUE } from '../constants/job.constants';
import { JobRecordService } from '../records/job-record.service';
import { JobRegistryService } from '../registry/job-registry.service';
import { IBullJobData, IJobContext } from '../types/job.types';

@Processor(DEFAULT_JOB_QUEUE)
export class JobProcessor extends WorkerHost {
  constructor(
    private readonly registry: JobRegistryService,
    private readonly records: JobRecordService,
    private readonly logger: LoggerService,
  ) {
    super();
  }

  async process(job: Job<IBullJobData>): Promise<unknown> {
    const { jobId, name, payload } = job.data;
    const maxAttempts = job.opts.attempts ?? 1;
    const attemptsMade = job.attemptsMade + 1;

    this.logger.log('Job processing started', {
      category: LOG_CATEGORY.JOB,
      context: {
        jobId,
        name,
        bullJobId: job.id,
        attemptsMade,
        maxAttempts,
      },
    });

    const activated = await this.records.markActive(
      jobId,
      job.id,
      attemptsMade,
    );
    if (!activated) {
      this.logger.warn('Job processing skipped', {
        category: LOG_CATEGORY.JOB,
        context: { jobId, name, reason: 'not-activatable' },
      });
      return { skipped: true, reason: 'not-cancellable-or-already-terminal' };
    }

    try {
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

      const result = await handler.handle(ctx);
      await this.records.markCompleted(jobId, result, attemptsMade);
      this.logger.log('Job processing completed', {
        category: LOG_CATEGORY.JOB,
        context: { jobId, name, attemptsMade },
      });
      return result;
    } catch (error) {
      const isFinal = attemptsMade >= maxAttempts;
      await this.records.markAttemptFailure(
        jobId,
        attemptsMade,
        error,
        isFinal,
      );

      this.logger.error('Job processing failed', error, {
        category: LOG_CATEGORY.JOB,
        context: {
          jobId,
          name,
          attemptsMade,
          maxAttempts,
          isFinal,
        },
      });

      throw error;
    }
  }
}
