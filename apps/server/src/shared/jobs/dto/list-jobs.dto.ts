import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { JOB_STATUS, JobStatus } from '../constants/job.constants';

const JOB_STATUS_VALUES = Object.values(JOB_STATUS);

export class ListJobsDto {
  @ApiPropertyOptional({ description: '任务名称，如 export-report' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    description: '任务状态',
    enum: JOB_STATUS_VALUES,
  })
  @IsOptional()
  @IsIn(JOB_STATUS_VALUES)
  status?: JobStatus;

  @ApiPropertyOptional({ description: '页码，从 1 开始', example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: '每页数量，最大 100', example: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number = 20;
}
