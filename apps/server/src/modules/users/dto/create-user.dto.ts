import { RoleCode } from '@/common/constants';
import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsEmail,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class CreateUserDto {
  @ApiProperty({
    description: 'The name of the user',
    example: 'xiaojian',
  })
  @IsString()
  username: string;

  @ApiProperty({
    description: 'The email of the user',
    example: 'test@test.com',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    description: 'The password of the user',
    example: 'password',
  })
  @IsString()
  @MinLength(8, {
    message: 'Password must be at least 8 characters',
  })
  password: string;

  @ApiProperty({
    description: 'The name of the user',
    example: 'xiaojian',
  })
  @IsOptional()
  @IsString()
  nickname?: string;

  @ApiProperty({
    description: 'The avatar of the user',
    example: 'avatar-url',
  })
  @IsOptional()
  @IsString()
  avatar?: string;

  @ApiProperty({
    description: '用户角色code列表',
    example: [RoleCode.ADMIN],
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  roles?: string[];
}
