import { REFRESH_TOKEN_KEY, TokenType } from '@/common/constants/auth';
import { JwtPayload } from '@/modules/auth/strategies/jwt-auth.strategy';
import { UsersService } from '@/modules/users/users.service';
import { Injectable, NestMiddleware } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { NextFunction, Request, Response } from 'express';

type JobBoardRequest = Pick<Request, 'headers' | 'cookies'>;
type JobBoardResponse = Pick<Response, 'status' | 'json'>;

@Injectable()
export class JobBoardAuthMiddleware implements NestMiddleware {
  constructor(
    private readonly jwtService: JwtService,
    private readonly usersService: UsersService,
  ) {}

  async use(req: JobBoardRequest, res: JobBoardResponse, next: NextFunction) {
    const tokenResult = this.extractToken(req);
    if (!tokenResult) {
      this.reject(res);
      return;
    }

    try {
      const payload = this.jwtService.verify<JwtPayload>(tokenResult.token);
      if (payload.type !== tokenResult.tokenType) {
        this.reject(res);
        return;
      }

      await this.usersService.findOne({ id: payload.sub });
      next();
    } catch {
      this.reject(res);
    }
  }

  private extractToken(req: JobBoardRequest) {
    const bearerToken = this.extractBearerToken(req.headers.authorization);
    if (bearerToken) {
      return { token: bearerToken, tokenType: TokenType.ACCESS };
    }

    const refreshToken = req.cookies?.[REFRESH_TOKEN_KEY] as string | undefined;
    if (refreshToken) {
      return { token: refreshToken, tokenType: TokenType.REFRESH };
    }

    return null;
  }

  private extractBearerToken(authorization?: string): string | null {
    if (!authorization?.startsWith('Bearer ')) return null;
    const token = authorization.slice('Bearer '.length).trim();
    return token || null;
  }

  private reject(res: JobBoardResponse) {
    res.status(401).json({
      statusCode: 401,
      message: 'Unauthorized',
      code: 'UNAUTHORIZED',
    });
  }
}
