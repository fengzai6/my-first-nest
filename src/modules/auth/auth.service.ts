import {
  AuthException,
  AuthExceptionCode,
} from '@/common/exceptions/auth.exception';
import { BaseResponse } from '@/common/response/base.response';
import { Injectable } from '@nestjs/common';
import { verify } from 'argon2';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { SignupDto } from './dto/signup.dto';
import { RefreshTokenService } from './refresh-token.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly refreshTokenService: RefreshTokenService,
  ) {}

  async signup(signupDto: SignupDto) {
    return await this.usersService.create(signupDto);
  }

  async login(loginDto: LoginDto) {
    const user = await this.usersService.findOne({
      username: loginDto.username,
    });

    if (!user) {
      throw new AuthException(AuthExceptionCode.USER_NOT_FOUND);
    }

    const isPasswordValid = await verify(user.password, loginDto.password);

    if (!isPasswordValid) {
      throw new AuthException(AuthExceptionCode.INVALID_CREDENTIALS);
    }

    return await this.refreshTokenService.create(user);
  }

  async logout(refreshToken: string) {
    await this.refreshTokenService.remove(refreshToken);

    return new BaseResponse('Logout successfully');
  }
}
