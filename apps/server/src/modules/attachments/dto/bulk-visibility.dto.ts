import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsString,
} from 'class-validator';
import { ATTACHMENT_VISIBILITY } from '../constants/attachment.constants';

export class BulkVisibilityDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  ids: string[];

  @ApiProperty({ enum: Object.values(ATTACHMENT_VISIBILITY) })
  @IsIn(Object.values(ATTACHMENT_VISIBILITY))
  visibility: 'private' | 'public';
}
