import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsNotEmpty, IsString } from 'class-validator';

export class AddGroupMembersDto {
  @ApiProperty({
    isArray: true,
    example: ['1', '2', '3'],
    description: '用户ID列表',
  })
  @IsNotEmpty()
  @IsArray()
  @IsString({ each: true })
  members: string[];
}
