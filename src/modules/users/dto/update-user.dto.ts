import { RegisterDto } from '@/modules/auth/dto/register.dto';
import { OmitType, PartialType } from '@nestjs/swagger';

export class UpdateUserDto extends PartialType(
  OmitType(RegisterDto, ['password'] as const),
) {}
