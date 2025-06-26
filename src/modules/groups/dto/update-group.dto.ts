import { ApiProperty, OmitType, PartialType } from '@nestjs/swagger';
import { IsString } from 'class-validator';
import { CreateGroupDto } from './create-group.dto';

export class UpdateGroupDto extends PartialType(
  OmitType(CreateGroupDto, ['addSelfAsMember', 'isOrganization'] as const),
) {
  @ApiProperty({
    example: '1',
  })
  @IsString()
  groupId: string;
}
