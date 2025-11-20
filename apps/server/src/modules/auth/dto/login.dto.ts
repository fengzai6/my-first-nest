import { PickType } from '@nestjs/swagger';
import { SignupDto } from './signup.dto';

export class LoginDto extends PickType(SignupDto, ['username', 'password']) {}
