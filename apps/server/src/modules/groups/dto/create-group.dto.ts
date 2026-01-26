import { ApiProperty, OmitType } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class CreateGroupDto {
  @ApiProperty({
    example: '群组名称',
  })
  @IsString()
  name: string;

  @ApiProperty({
    example: '1',
  })
  @IsString()
  parentId: string;

  @ApiProperty({
    example: '群组描述',
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    example: true,
  })
  @IsBoolean()
  @IsOptional()
  isOrganization?: boolean;

  @ApiProperty({
    example: true,
  })
  @IsBoolean()
  @IsOptional()
  addSelfToGroup?: boolean;
}

// service 中的 parentId 可选
export class CreateGroupServiceDto extends OmitType(CreateGroupDto, [
  'parentId',
]) {
  parentId?: string;
}

export class CreateRootOrgGroupDto extends OmitType(CreateGroupDto, [
  'parentId',
  'isOrganization',
]) {}
