import { OmitType, PartialType } from '@nestjs/swagger';
import { SignupDto } from 'src/modules/auth/dto/signup.dto';

export class UpdateUserDto extends PartialType(
  OmitType(SignupDto, ['password'] as const),
) {}
