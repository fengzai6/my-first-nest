import { Public } from '@/common/decorators/jwt-auth.decorator';
import {
  JOB_NAMES,
  JOB_TRIGGER_TYPE,
} from '@/shared/jobs/constants/job.constants';
import { JobService } from '@/shared/jobs/services/job.service';
import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ExportReportDto } from './dto/export-report.dto';
import { FlakyRetryDto } from './dto/flaky-retry.dto';

@ApiTags('Demo Jobs - 任务示例')
@Controller('demo-jobs')
export class DemoJobsController {
  constructor(private readonly jobService: JobService) {}

  @Public()
  @Post('export-report')
  @ApiOperation({
    summary: '提交异步导出任务',
    description: '立即返回 jobId，可通过 GET /jobs/:id 轮询进度',
  })
  exportReport(@Body() body: ExportReportDto) {
    return this.jobService.submit({
      name: JOB_NAMES.EXPORT_REPORT,
      payload: {
        title: body.title ?? 'monthly-report',
        steps: body.steps ?? 5,
        stepDelayMs: body.stepDelayMs ?? 500,
      },
      delayMs: body.delayMs ?? 0,
      attempts: 1,
      triggerType: JOB_TRIGGER_TYPE.MANUAL,
    });
  }

  @Public()
  @Post('flaky-retry')
  @ApiOperation({
    summary: '提交失败重试示例任务',
    description: '前 N 次失败，演示 BullMQ attempts / backoff 与落库记录',
  })
  flakyRetry(@Body() body: FlakyRetryDto) {
    return this.jobService.submit({
      name: JOB_NAMES.FLAKY_RETRY,
      payload: {
        failTimes: body.failTimes ?? 2,
      },
      attempts: 3,
      backoffMs: 1000,
      triggerType: JOB_TRIGGER_TYPE.MANUAL,
    });
  }
}
