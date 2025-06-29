import {
  AuthException,
  AuthExceptionCode,
} from '@/common/exceptions/auth.exception';
import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { verify } from 'argon2';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async login(loginDto: LoginDto) {
    const user = await this.usersService.find(loginDto.username);

    if (!user) {
      throw new AuthException(AuthExceptionCode.USER_NOT_FOUND);
    }

    const isPasswordValid = await verify(user.password, loginDto.password);

    if (!isPasswordValid) {
      throw new AuthException(AuthExceptionCode.INVALID_CREDENTIALS);
    }

    return {
      user,
      accessToken: this.jwtService.sign({
        id: user.id,
        username: user.username,
      }),
    };
  }
}
