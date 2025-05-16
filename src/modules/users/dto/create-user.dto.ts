import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsEnum, IsString } from 'class-validator';
import { RolesEnum } from 'src/common/guards/roles.decorator';

export class CreateUserDto {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty()
  @IsString()
  email: string;

  @ApiProperty()
  @IsString()
  password: string;

  @ApiProperty()
  @IsArray()
  @IsEnum(RolesEnum, { each: true })
  role: RolesEnum[];
}
