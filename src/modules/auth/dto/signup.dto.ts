import { RolesEnum } from '@/common/decorators/roles.decorator';
import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  Length,
} from 'class-validator';

export class SignupDto {
  @ApiProperty({
    description: 'The name of the user',
    example: 'John Doe',
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
  @Length(8, 20, {
    message: 'Password must be between 8 and 20 characters',
  })
  password: string;

  @ApiProperty({
    description: 'The role of the user',
    example: [RolesEnum.User],
  })
  @IsArray()
  @IsEnum(RolesEnum, { each: true })
  @IsOptional()
  role: RolesEnum[];
}
