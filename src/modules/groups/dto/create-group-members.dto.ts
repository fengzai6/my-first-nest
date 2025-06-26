import { GroupMemberRolesEnum } from '@/common/decorators/group-member-roles.decorator';
import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsString } from 'class-validator';

class AddGroupMemberDto {
  @ApiProperty({
    example: '1',
  })
  @IsNotEmpty()
  @IsString()
  userId: string;

  @ApiProperty({
    example: GroupMemberRolesEnum.Member,
  })
  @IsNotEmpty()
  @IsString()
  @IsEnum(GroupMemberRolesEnum)
  role: GroupMemberRolesEnum;
}

export class AddGroupMembersDto extends Array<AddGroupMemberDto> {}
