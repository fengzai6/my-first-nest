import { RoleCode } from '@/common/constants';
import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsEmail, IsString, MinLength } from 'class-validator';

export class RegisterDto {
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
    description: '用户角色code列表',
    example: [RoleCode.ADMIN],
  })
  @IsArray()
  @IsString({ each: true })
  roles: string[];
}
