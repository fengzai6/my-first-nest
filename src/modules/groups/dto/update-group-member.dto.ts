import { GroupMemberRolesEnum } from '@/common/decorators/group-member-roles.decorator';
import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsString } from 'class-validator';

export class UpdateGroupMemberDto {
  @ApiProperty({
    enum: GroupMemberRolesEnum,
    example: GroupMemberRolesEnum.Member,
    description:
      '群组成员角色，可选枚举值：' +
      Object.values(GroupMemberRolesEnum)
        .filter((role) => role !== GroupMemberRolesEnum.SuperiorLeader)
        .map((role) => `"${role}"`)
        .join(', '),
  })
  @IsNotEmpty()
  @IsString()
  @IsEnum(GroupMemberRolesEnum)
  role: GroupMemberRolesEnum;
}
