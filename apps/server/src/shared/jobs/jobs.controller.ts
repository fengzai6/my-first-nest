import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { JOB_SSE_EVENT } from './constants/job.constants';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { JobEventsService } from './events/job-events.service';
import { formatSseEvent } from './events/job-sse.util';
import { ListJobsDto } from './dto/list-jobs.dto';
import { JobService } from './services/job.service';
import { JOB_TERMINAL_STATUSES } from './types/job.types';
import { SkipTimeout } from '@/common/decorators/skip-timeout.decorator';

@ApiTags('Jobs - 任务中心')
@ApiBearerAuth()
@Controller('jobs')
export class JobsController {
  constructor(
    private readonly jobService: JobService,
    private readonly jobEvents: JobEventsService,
  ) {}

  @Get()
  @ApiOperation({ summary: '分页查询任务执行记录' })
  list(@Query() query: ListJobsDto) {
    return this.jobService.list(query);
  }

  @Get(':id/events')
  @ApiOperation({ summary: '订阅单个任务状态事件（SSE）' })
  @ApiParam({ name: 'id', description: 'job_runs.id' })
  @SkipTimeout()
  async getEvents(
    @Param('id') id: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const endStream = () => {
      if (!res.writableEnded) {
        res.end();
      }
    };

    const subscription = this.jobEvents.subscribe(id).subscribe((event) => {
      res.write(formatSseEvent(event));
      if (JOB_TERMINAL_STATUSES.includes(event.data.status)) {
        subscription.unsubscribe();
        endStream();
      }
    });

    req.on('close', () => {
      subscription.unsubscribe();
    });

    const snapshot = await this.jobService.getById(id);

    res.write(
      formatSseEvent({
        id: 'snapshot',
        event: JOB_SSE_EVENT.SNAPSHOT,
        data: snapshot,
      }),
    );

    if (JOB_TERMINAL_STATUSES.includes(snapshot.status)) {
      subscription.unsubscribe();
      endStream();
    }
  }

  @Get(':id')
  @ApiOperation({ summary: '查询单个任务状态（轮询）' })
  @ApiParam({ name: 'id', description: 'job_runs.id' })
  getById(@Param('id') id: string) {
    return this.jobService.getById(id);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '取消 queued / delayed 任务' })
  @ApiParam({ name: 'id', description: 'job_runs.id' })
  cancel(@Param('id') id: string) {
    return this.jobService.cancel(id);
  }
}
