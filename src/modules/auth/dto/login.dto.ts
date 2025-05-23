import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Length } from 'class-validator';

export class LoginDto {
  @IsString()
  @IsNotEmpty()
  @ApiProperty({
    description: 'The username of the user',
    example: 'xiaojian',
  })
  username: string;

  @IsString()
  @IsNotEmpty()
  @Length(8, 20, {
    message: 'Password must be between 8 and 20 characters',
  })
  @ApiProperty({
    description: 'The password of the user',
    example: 'password',
  })
  password: string;
}
