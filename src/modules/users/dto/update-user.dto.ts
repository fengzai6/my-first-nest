import { RoleCode } from '@/common/constants';
import { SpecialRolesEnum } from '@/common/decorators';
import { ApiProperty, OmitType, PartialType } from '@nestjs/swagger';
import { IsArray, IsEnum, IsString } from 'class-validator';
import { CreateUserDto } from './create-user.dto';

export class UpdateUserDto extends PartialType(
  OmitType(CreateUserDto, ['password', 'roles'] as const),
) {}

export class UpdateUserRolesDto {
  @ApiProperty({
    description: '用户角色code列表',
    example: [RoleCode.ADMIN],
  })
  @IsArray()
  @IsString({ each: true })
  roles: string[];
}

export class UpdateUserSpecialRolesDto {
  @ApiProperty({
    description: '用户特殊角色code列表',
    example: [SpecialRolesEnum.Developer],
  })
  @IsEnum(SpecialRolesEnum, { each: true })
  roles: SpecialRolesEnum[];
}
