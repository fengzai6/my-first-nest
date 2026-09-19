import { MAX_ATTACHMENT_COUNT } from '@/modules/attachments/constants/attachment.constants';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import {
  DOCUMENT_STATUS,
  DocumentStatus,
} from '../constants/document.constants';

export class CreateDocumentDto {
  @ApiProperty({ maxLength: 200 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;

  @ApiProperty()
  @IsString()
  content: string;

  @ApiPropertyOptional({ enum: Object.values(DOCUMENT_STATUS) })
  @IsOptional()
  @IsEnum(DOCUMENT_STATUS)
  status?: DocumentStatus;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(MAX_ATTACHMENT_COUNT)
  @IsString({ each: true })
  attachmentIds?: string[];
}
