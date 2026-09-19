import { ATTACHMENT_VISIBILITY } from '../constants/attachment.constants';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

const VISIBILITY_VALUES = Object.values(ATTACHMENT_VISIBILITY);

export class FindManagementAttachmentsDto {
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

  @ApiPropertyOptional({ description: '按原始文件名模糊搜索' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  keyword?: string;

  @ApiPropertyOptional({ description: 'MIME 类型' })
  @IsOptional()
  @IsString()
  @MaxLength(127)
  mimeType?: string;

  @ApiPropertyOptional({ enum: VISIBILITY_VALUES })
  @IsOptional()
  @IsIn(VISIBILITY_VALUES)
  visibility?: (typeof ATTACHMENT_VISIBILITY)[keyof typeof ATTACHMENT_VISIBILITY];

  @ApiPropertyOptional({ description: '业务类型' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  bizType?: string;

  @ApiPropertyOptional({ description: '业务 ID' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  bizId?: string;

  @ApiPropertyOptional({ description: '上传人用户名或显示名' })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  uploader?: string;

  @ApiPropertyOptional({ description: '是否包含已软删除附件' })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  includeDeleted?: boolean = false;

  @ApiPropertyOptional({ description: '是否只查询未绑定孤儿附件' })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  orphanOnly?: boolean = false;

  @ApiPropertyOptional({ description: '创建时间下限' })
  @IsOptional()
  @IsDateString()
  createdFrom?: string;

  @ApiPropertyOptional({ description: '创建时间上限' })
  @IsOptional()
  @IsDateString()
  createdTo?: string;
}
