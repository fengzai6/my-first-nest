import { CreateUserDto } from '@/modules/users/dto/create-user.dto';
import { OmitType } from '@nestjs/swagger';

export class RegisterDto extends OmitType(CreateUserDto, ['roles'] as const) {}
