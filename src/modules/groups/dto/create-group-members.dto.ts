import { GroupMemberRolesEnum } from '@/common/decorators/group-member-roles';
import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsNumber, IsString } from 'class-validator';

class AddGroupMemberDto {
  @ApiProperty({
    example: 1,
  })
  @IsNotEmpty()
  @IsNumber()
  userId: number;

  @ApiProperty({
    example: GroupMemberRolesEnum.Member,
  })
  @IsNotEmpty()
  @IsString()
  @IsEnum(GroupMemberRolesEnum)
  role: GroupMemberRolesEnum;
}

export class AddGroupMembersDto extends Array<AddGroupMemberDto> {}
