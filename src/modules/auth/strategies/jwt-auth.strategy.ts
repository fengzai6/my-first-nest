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
  id: number;
  username: string;
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
    const { id } = payload;

    const user = await this.usersService.findOne(id);

    if (!user) {
      throw new AuthException(AuthExceptionCode.USER_NOT_FOUND);
    }

    return user;
  }
}
