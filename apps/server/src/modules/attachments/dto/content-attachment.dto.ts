import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNumberString,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class ContentAttachmentDto {
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
}
