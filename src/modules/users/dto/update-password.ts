import { ApiProperty, PickType } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class UpdatePasswordDto {
  @ApiProperty({
    description: 'The old password',
    example: 'password',
  })
  @IsString()
  oldPassword: string;

  @ApiProperty({
    description: 'The new password',
    example: 'password',
  })
  @IsString()
  @MinLength(8, {
    message: 'Password must be at least 8 characters',
  })
  newPassword: string;
}

export class UpdatePasswordByAdminDto extends PickType(UpdatePasswordDto, [
  'newPassword',
] as const) {}
