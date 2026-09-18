import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import { ATTACHMENT_VISIBILITY } from '../constants/attachment.constants';

export class UpdateManagementVisibilityDto {
  @ApiProperty({ enum: Object.values(ATTACHMENT_VISIBILITY) })
  @IsIn(Object.values(ATTACHMENT_VISIBILITY))
  visibility: 'private' | 'public';
}
