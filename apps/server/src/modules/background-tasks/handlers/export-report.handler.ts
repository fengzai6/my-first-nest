import { JOB_NAMES } from '@/shared/jobs/constants/job.constants';
import { JobRegistryService } from '@/shared/jobs/registry/job-registry.service';
import { IJobContext, IJobHandler } from '@/shared/jobs/types/job.types';
import { Injectable } from '@nestjs/common';

export interface IExportReportPayload {
  title?: string;
  steps?: number;
  stepDelayMs?: number;
}

export interface IExportReportResult {
  title: string;
  downloadUrl: string;
  steps: number;
}

const sleep = (ms: number) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

@Injectable()
export class ExportReportHandler implements IJobHandler<
  IExportReportPayload,
  IExportReportResult
> {
  readonly name = JOB_NAMES.EXPORT_REPORT;

  constructor(registry: JobRegistryService) {
    registry.register(this);
  }

  async handle(
    ctx: IJobContext<IExportReportPayload>,
  ): Promise<IExportReportResult> {
    const title = ctx.payload?.title || 'monthly-report';
    const steps = Math.max(1, ctx.payload?.steps ?? 5);
    const stepDelayMs = Math.max(0, ctx.payload?.stepDelayMs ?? 500);

    for (let step = 1; step <= steps; step += 1) {
      if (stepDelayMs > 0) {
        await sleep(stepDelayMs);
      }
      await ctx.updateProgress((step / steps) * 100);
    }

    return {
      title,
      downloadUrl: `mock://exports/${ctx.jobId}/${title}.csv`,
      steps,
    };
  }
}
