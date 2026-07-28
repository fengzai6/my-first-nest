import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { ListJobsDto } from './dto/list-jobs.dto';
import { JobService } from './services/job.service';

@ApiTags('Jobs - 任务中心')
@ApiBearerAuth()
@Controller('jobs')
export class JobsController {
  constructor(private readonly jobService: JobService) {}

  @Get()
  @ApiOperation({ summary: '分页查询任务执行记录' })
  list(@Query() query: ListJobsDto) {
    return this.jobService.list(query);
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
