import { extractWsToken } from '@/shared/utils/extract-token';
import { getConfig } from '@/config/configuration';
import { AuthSocket } from '@/modules/socket/interface/auth-socket';
import { JwtPayload } from '@/modules/auth/strategies/jwt-auth.strategy';
import { UsersService } from '@/modules/users/users.service';
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { WsException } from '@nestjs/websockets';
import { TokenType } from '../constants/auth';

@Injectable()
export class WsJwtGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const client = context.switchToWs().getClient<AuthSocket>();
    const token = extractWsToken(client);

    if (!token) {
      throw new WsException({ status: 401, message: 'No token provided' });
    }

    let payload: JwtPayload;
    try {
      payload = this.jwtService.verify<JwtPayload>(token, {
        secret: getConfig(this.configService).jwt.secret,
      });
    } catch {
      throw new WsException({ status: 401, message: 'Invalid token' });
    }

    if (payload.type !== TokenType.ACCESS) {
      throw new WsException({ status: 401, message: 'Invalid token type' });
    }

    const user = await this.usersService.findOne({ id: payload.sub });

    client.user = user;
    return true;
  }
}
