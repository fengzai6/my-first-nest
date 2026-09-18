import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import type { TransformFnParams } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsNumberString,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class ContentAttachmentDto {
  @ApiPropertyOptional({
    description: '是否作为附件下载',
    enum: ['1'],
  })
  @IsOptional()
  @Transform(({ value }: TransformFnParams) =>
    value === '1' ? true : (value as unknown),
  )
  @IsBoolean()
  download?: boolean;

  @ApiPropertyOptional({ description: '签名过期时间戳' })
  @IsOptional()
  @IsNumberString()
  expiresAt?: string;

  @ApiPropertyOptional({ description: '签名所属用户 ID' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  userId?: string;

  @ApiPropertyOptional({ description: '访问签名' })
  @IsOptional()
  @IsString()
  @MaxLength(256)
  signature?: string;

  @ApiPropertyOptional({
    description: '签名作用域：user 或 admin，默认 user',
    enum: ['user', 'admin'],
  })
  @IsOptional()
  @IsIn(['user', 'admin'])
  scope?: 'user' | 'admin' = 'user';
}
