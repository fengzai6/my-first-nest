import { JOB_NAMES } from '@/shared/jobs/constants/job.constants';
import { JobRegistryService } from '@/shared/jobs/registry/job-registry.service';
import { IJobContext, IJobHandler } from '@/shared/jobs/types/job.types';
import { Injectable } from '@nestjs/common';

export interface IFlakyRetryPayload {
  failTimes?: number;
}

export interface IFlakyRetryResult {
  recovered: boolean;
  attemptsMade: number;
  failTimes: number;
}

@Injectable()
export class FlakyRetryHandler implements IJobHandler<
  IFlakyRetryPayload,
  IFlakyRetryResult
> {
  readonly name = JOB_NAMES.FLAKY_RETRY;

  constructor(registry: JobRegistryService) {
    registry.register(this);
  }

  async handle(
    ctx: IJobContext<IFlakyRetryPayload>,
  ): Promise<IFlakyRetryResult> {
    const failTimes = Math.max(0, ctx.payload?.failTimes ?? 2);

    // attemptsMade 从 1 开始；前 failTimes 次故意失败
    if (ctx.attemptsMade <= failTimes) {
      throw new Error(
        `Simulated failure on attempt ${ctx.attemptsMade}/${ctx.maxAttempts}`,
      );
    }

    await ctx.updateProgress(100);

    return {
      recovered: true,
      attemptsMade: ctx.attemptsMade,
      failTimes,
    };
  }
}
