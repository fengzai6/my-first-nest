import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  DOCUMENT_STATUS,
  DocumentStatus,
} from '../constants/document.constants';

export class FindDocumentsDto {
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

  @ApiPropertyOptional({ enum: Object.values(DOCUMENT_STATUS) })
  @IsOptional()
  @IsEnum(DOCUMENT_STATUS)
  status?: DocumentStatus;

  @ApiPropertyOptional({ description: '按标题模糊搜索' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  keyword?: string;
}
