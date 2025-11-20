import { PermissionCodeType } from '@/common/constants/permissions';
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreatePermissionDto {
  @ApiProperty({
    description: '权限名称',
    example: '创建用户',
  })
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsNotEmpty()
  @IsString()
  code: PermissionCodeType;

  @IsOptional()
  @IsString()
  description?: string;
}
