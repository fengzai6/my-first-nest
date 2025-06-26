import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateGroupDto {
  @ApiProperty({
    example: '群组名称',
  })
  @IsString()
  name: string;

  @ApiProperty({
    example: '群组描述',
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    example: '1',
  })
  @IsString()
  @IsOptional()
  parentId?: string;

  @ApiProperty({
    example: true,
  })
  @IsBoolean()
  @IsOptional()
  isOrganization?: boolean;

  @ApiProperty({
    example: '1',
  })
  @IsString()
  @IsOptional()
  leaderId?: string;

  @ApiProperty({
    example: true,
  })
  @IsBoolean()
  @IsOptional()
  addSelfAsMember?: boolean;
}
