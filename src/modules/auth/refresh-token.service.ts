import { TokenType } from '@/common/constants/auth';
import { AuthException, AuthExceptionCode } from '@/common/exceptions';
import { getConfig } from '@/config/configuration';
import { User } from '@/modules/users/entities';
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
  ) {}

  async create(user: User) {
    const tokens = await this.generateTokens(user);

    const refreshToken = this.refreshTokenRepository.create({
      token: tokens.refreshToken,
      expiresAt: tokens.refreshExpiresAt,
      user,
    });

    await this.refreshTokenRepository.save(refreshToken);

    // TODO：根据是否启用了 Redis 来决定是否将 refreshToken 存储到 Redis 中
    // 生成一个 tokenKey, refreshToken 作为 value, 并设置过期时间为 config 中的值
    // 这样就不需要管理 refreshToken 的数据库，Redis 中存储的 refreshToken 过期后，会自动删除

    return tokens;
  }

  async refreshToken(refreshToken: string) {
    const tokenRecord = await this.refreshTokenRepository.findOne({
      where: { token: refreshToken },
      relations: ['user'],
    });

    if (!tokenRecord || tokenRecord.expiresAt < new Date()) {
      if (tokenRecord) {
        await this.remove(tokenRecord);
      }

      throw new AuthException(AuthExceptionCode.INVALID_REFRESH_TOKEN);
    }

    const tokens = await this.generateTokens(tokenRecord.user);

    await this.refreshTokenRepository.update(tokenRecord.id, {
      token: tokens.refreshToken,
      expiresAt: tokens.refreshExpiresAt,
    });

    return tokens;
  }

  async generateTokens(user: User) {
    const payload: JwtPayload = {
      sub: user.id,
      type: TokenType.ACCESS,
    };

    const accessToken = this.jwtService.sign(payload);
    const refreshToken = this.jwtService.sign(
      { ...payload, type: TokenType.REFRESH },
      {
        expiresIn: getConfig(this.configService).jwt.refreshExpiresIn,
      },
    );

    const accessExpiresAt = new Date();
    accessExpiresAt.setSeconds(
      accessExpiresAt.getSeconds() +
        getConfig(this.configService).jwt.accessExpiresIn,
    );

    const refreshExpiresAt = new Date();
    refreshExpiresAt.setSeconds(
      refreshExpiresAt.getSeconds() +
        getConfig(this.configService).jwt.refreshExpiresIn,
    );

    return { accessToken, refreshToken, accessExpiresAt, refreshExpiresAt };
  }

  async remove(token: RefreshToken | string) {
    // TODO: Redis: 登出时，删除 Redis 中的 refreshToken 和将 accessToken 设置为黑名单（如何拿到 accessToken ）
    // 同时需要在 JwtAuthGuard 中处理黑名单的 accessToken

    if (!token) {
      return;
    }

    if (typeof token === 'string') {
      await this.refreshTokenRepository.delete({ token });
    } else {
      await this.refreshTokenRepository.remove(token);
    }
  }
}
