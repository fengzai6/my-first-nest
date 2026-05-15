import { TokenType } from '@/common/constants/auth';
import {
  ErrorException,
  ErrorExceptionCode,
} from '@/common/exceptions/error.exception';
import { getConfig } from '@/config/configuration';
import { User } from '@/modules/users/entities/user.entity';
import { UsersService } from '@/modules/users/users.service';
import { CacheKeys } from '@/shared/caching/cache.constants';
import { CacheService } from '@/shared/caching/cache.service';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RefreshToken } from './entities/refresh-token.entity';
import { JwtPayload } from './strategies/jwt-auth.strategy';

@Injectable()
export class RefreshTokenService {
  constructor(
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepository: Repository<RefreshToken>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly cacheService: CacheService,
    private readonly usersService: UsersService,
  ) {}

  async create(user: User) {
    const tokens = this.generateTokens(user);

    if (this.cacheService.isRedisEnabled()) {
      const { jwt } = getConfig(this.configService);
      await this.cacheService.set(
        CacheKeys.AUTH_REFRESH_TOKEN(tokens.refreshToken),
        user.id,
        jwt.refreshExpiresIn,
      );
      return tokens;
    }

    const refreshToken = this.refreshTokenRepository.create({
      token: tokens.refreshToken,
      expiresAt: tokens.refreshExpiresAt,
      user,
    });

    await this.refreshTokenRepository.save(refreshToken);

    return tokens;
  }

  async refreshToken(refreshToken: string | undefined) {
    if (!refreshToken) {
      throw new ErrorException(ErrorExceptionCode.INVALID_REFRESH_TOKEN);
    }

    if (this.cacheService.isRedisEnabled()) {
      return this.refreshTokenViaRedis(refreshToken);
    }
    return this.refreshTokenViaDb(refreshToken);
  }

  generateTokens(user: User) {
    const payload: JwtPayload = {
      sub: user.id,
      type: TokenType.ACCESS,
    };

    const { jwt } = getConfig(this.configService);

    const accessToken = this.jwtService.sign(payload);
    const refreshToken = this.jwtService.sign(
      { ...payload, type: TokenType.REFRESH },
      {
        expiresIn: jwt.refreshExpiresIn,
      },
    );

    const accessExpiresAt = Date.now() + jwt.accessExpiresIn * 1000;
    const refreshExpiresAt = new Date(Date.now() + jwt.refreshExpiresIn * 1000);

    return { accessToken, refreshToken, accessExpiresAt, refreshExpiresAt };
  }

  async remove(token: RefreshToken | string) {
    if (!token) {
      return;
    }

    if (this.cacheService.isRedisEnabled()) {
      const tokenStr = typeof token === 'string' ? token : token.token;
      await this.cacheService.del(CacheKeys.AUTH_REFRESH_TOKEN(tokenStr));
      return;
    }

    if (typeof token === 'string') {
      await this.refreshTokenRepository.delete({ token });
    } else {
      await this.refreshTokenRepository.remove(token);
    }
  }

  private async refreshTokenViaDb(refreshToken: string) {
    const tokenRecord = await this.refreshTokenRepository.findOne({
      where: { token: refreshToken },
      relations: ['user'],
    });

    if (!tokenRecord || tokenRecord.expiresAt < new Date()) {
      if (tokenRecord) {
        await this.remove(tokenRecord);
      }

      throw new ErrorException(ErrorExceptionCode.INVALID_REFRESH_TOKEN);
    }

    const tokens = this.generateTokens(tokenRecord.user);

    await this.refreshTokenRepository.update(tokenRecord.id, {
      token: tokens.refreshToken,
      expiresAt: tokens.refreshExpiresAt,
    });

    return tokens;
  }

  private async refreshTokenViaRedis(refreshToken: string) {
    const oldKey = CacheKeys.AUTH_REFRESH_TOKEN(refreshToken);
    const userId = await this.cacheService.get<string>(oldKey);

    if (!userId) {
      throw new ErrorException(ErrorExceptionCode.INVALID_REFRESH_TOKEN);
    }

    let user: User;
    try {
      user = await this.usersService.findOne({ id: userId });
    } catch {
      // 用户已被删除等情况：清理孤立的 refresh token 并拒绝
      await this.cacheService.del(oldKey);
      throw new ErrorException(ErrorExceptionCode.INVALID_REFRESH_TOKEN);
    }

    const tokens = this.generateTokens(user);
    const { jwt } = getConfig(this.configService);

    // 旋转：先删旧 key，再写新 key
    await this.cacheService.del(oldKey);
    await this.cacheService.set(
      CacheKeys.AUTH_REFRESH_TOKEN(tokens.refreshToken),
      user.id,
      jwt.refreshExpiresIn,
    );

    return tokens;
  }
}
