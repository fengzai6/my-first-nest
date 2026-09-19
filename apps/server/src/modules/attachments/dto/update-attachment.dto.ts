import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import {
  ATTACHMENT_VISIBILITY,
  AttachmentVisibility,
} from '../constants/attachment.constants';

export class UpdateAttachmentDto {
  @ApiPropertyOptional({
    description: '附件可见性',
    enum: Object.values(ATTACHMENT_VISIBILITY),
  })
  @IsOptional()
  @IsEnum(ATTACHMENT_VISIBILITY)
  visibility?: AttachmentVisibility;
}
