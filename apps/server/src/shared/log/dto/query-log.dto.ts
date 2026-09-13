import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateBy,
} from 'class-validator';
import { LOG_LEVEL, LogLevel } from '../constants/log.constants';

const LOG_LEVEL_VALUES = Object.values(LOG_LEVEL);
const MAX_POSTGRES_BIGINT = 9223372036854775807n;

const IsPostgresBigint = () =>
  ValidateBy({
    name: 'isPostgresBigint',
    validator: {
      validate: (value: unknown) =>
        typeof value === 'string' &&
        /^\d+$/.test(value) &&
        BigInt(value) <= MAX_POSTGRES_BIGINT,
    },
  });

export class QueryLogDto {
  @ApiPropertyOptional({
    description: '日志级别',
    enum: LOG_LEVEL_VALUES,
  })
  @IsOptional()
  @IsIn(LOG_LEVEL_VALUES)
  level?: LogLevel;

  @ApiPropertyOptional({ description: '日志类别' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  category?: string;

  @ApiPropertyOptional({ description: '用户 ID' })
  @IsOptional()
  @IsString()
  @Matches(/^\d+$/)
  @IsPostgresBigint()
  userId?: string;

  @ApiPropertyOptional({ description: '请求 ID' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  requestId?: string;

  @ApiPropertyOptional({ description: '开始时间（ISO 8601）' })
  @IsOptional()
  @IsDateString()
  startTime?: string;

  @ApiPropertyOptional({ description: '结束时间（ISO 8601）' })
  @IsOptional()
  @IsDateString()
  endTime?: string;

  @ApiPropertyOptional({ description: '消息关键词' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  keyword?: string;

  @ApiPropertyOptional({ description: '页码，从 1 开始', example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ description: '每页数量，最大 100', example: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 20;
}
