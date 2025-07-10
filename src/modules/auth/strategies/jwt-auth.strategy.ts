import { TokenType } from '@/common/constants/auth';
import {
  AuthException,
  AuthExceptionCode,
} from '@/common/exceptions/auth.exception';
import { getConfig } from '@/config/configuration';
import { UsersService } from '@/modules/users/users.service';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

export interface JwtPayload {
  sub: string;
  type: TokenType;
}

@Injectable()
export class JwtAuthStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    protected configService: ConfigService,
    private readonly usersService: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: getConfig(configService).jwt.secret,
    });
  }

  async validate(payload: JwtPayload) {
    // 只允许 accessToken 访问，防止 refreshToken 被用于身份验证
    if (payload.type !== TokenType.ACCESS) {
      throw new AuthException(AuthExceptionCode.UNAUTHORIZED);
    }

    const user = await this.usersService.findOne(
      { id: payload.sub },
      {
        roles: {
          permissions: true,
        },
      },
    );

    if (!user) {
      throw new AuthException(AuthExceptionCode.USER_NOT_FOUND);
    }

    return user;
  }
}
