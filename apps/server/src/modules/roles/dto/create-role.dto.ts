import {
  PermissionCode,
  PermissionCodeType,
} from '@/common/constants/permissions';
import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';

export class CreateRoleDto {
  @ApiProperty({
    description: '角色名称',
    example: 'admin',
  })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({
    description: '角色描述',
    example: '管理员',
  })
  @IsOptional()
  @IsNotEmpty()
  @IsString()
  description: string;

  @ApiProperty({
    description: '角色编码',
    example: 'admin',
  })
  @IsNotEmpty()
  @IsString()
  @Matches(/^[a-zA-Z0-9][a-zA-Z0-9_-]*[a-zA-Z0-9]$|^[a-zA-Z0-9]$/, {
    message:
      '角色代码只能包含字母、数字、下划线和短横线，且不能以下划线或短横线开头或结尾',
  })
  code: string;

  @ApiProperty({
    description: '角色权限',
    example: [PermissionCode.USER_CREATE, PermissionCode.USER_READ],
  })
  @IsNotEmpty()
  @IsArray()
  @IsEnum(PermissionCode, { each: true })
  permissions: PermissionCodeType[];
}
