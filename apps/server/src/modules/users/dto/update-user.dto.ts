import { RoleCode } from '@/common/constants/roles';
import { SpecialRolesEnum } from '@/common/decorators/special-roles.decorator';
import { ApiProperty, OmitType, PartialType } from '@nestjs/swagger';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsEnum, IsOptional, IsString } from 'class-validator';
import { CreateUserDto } from './create-user.dto';

export class UpdateUserDto extends PartialType(
  OmitType(CreateUserDto, ['password', 'roles'] as const),
) {
  @ApiPropertyOptional({ description: '新头像附件 ID' })
  @IsOptional()
  @IsString()
  avatarAttachmentId?: string;
}

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
