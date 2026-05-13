import {
  ErrorException,
  ErrorExceptionCode,
} from '@/common/exceptions/error.exception';
import { BaseException } from '@/common/exceptions/base.exception';
import { BaseResponse } from '@/common/response/base.response';
import { Injectable } from '@nestjs/common';
import { verify } from 'argon2';
import { User } from '../users/entities/user.entity';
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
    // 安全考虑：登录失败时不区分「用户不存在」与「密码错误」，统一抛 INVALID_CREDENTIALS，
    // 否则攻击者可以根据错误码差异枚举出系统中有效的用户名。
    // findOne 在用户不存在时会抛 USER_NOT_FOUND，这里捕获后改抛 INVALID_CREDENTIALS；
    // 其他类型异常（如 DB 错误）继续向上抛出，不吞错。
    let user: User;
    try {
      user = await this.usersService.findOne({
        username: loginDto.username,
      });
    } catch (err) {
      if (
        err instanceof BaseException &&
        err.code === ErrorExceptionCode.USER_NOT_FOUND
      ) {
        throw new ErrorException(ErrorExceptionCode.INVALID_CREDENTIALS);
      }
      throw err;
    }

    const isPasswordValid = await verify(user.password, loginDto.password);

    if (!isPasswordValid) {
      throw new ErrorException(ErrorExceptionCode.INVALID_CREDENTIALS);
    }

    return await this.refreshTokenService.create(user);
  }

  async logout(refreshToken: string) {
    await this.refreshTokenService.remove(refreshToken);

    return new BaseResponse('Logout successfully');
  }
}
