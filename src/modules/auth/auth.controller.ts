import { IsProduction } from '@/common/constants';
import { REFRESH_TOKEN_KEY } from '@/common/constants/auth';
import { Cookies } from '@/common/decorators/cookies.decorator';
import { Public } from '@/common/decorators/jwt-auth.decorator';
import { getConfig } from '@/config/configuration';
import { Body, Controller, Post, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { SignupDto } from './dto/signup.dto';
import { RefreshTokenService } from './refresh-token.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly refreshTokenService: RefreshTokenService,
    private readonly configService: ConfigService,
  ) {}

  @ApiOperation({
    summary: 'Sign up',
  })
  @Public()
  @Post('signup')
  signup(@Body() signupDto: SignupDto) {
    return this.authService.signup(signupDto);
  }

  @ApiOperation({
    summary: 'Login',
  })
  @Public()
  @Post('login')
  async login(
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const tokens = await this.authService.login(loginDto);

    this.setRefreshTokenCookie(res, tokens.refreshToken);

    return {
      accessToken: tokens.accessToken,
      expiresAt: tokens.accessExpiresAt,
    };
  }

  @ApiOperation({
    summary: 'Refresh token',
  })
  @Public()
  @Post('refresh-token')
  async refreshToken(
    @Cookies(REFRESH_TOKEN_KEY) refreshToken: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    const tokens = await this.refreshTokenService.refreshToken(refreshToken);

    this.setRefreshTokenCookie(res, tokens.refreshToken);

    return {
      accessToken: tokens.accessToken,
      expiresAt: tokens.accessExpiresAt,
    };
  }

  @ApiOperation({
    summary: 'Logout',
  })
  @ApiBearerAuth()
  @Post('logout')
  logout(
    @Cookies(REFRESH_TOKEN_KEY) refreshToken: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.clearCookie(REFRESH_TOKEN_KEY);

    return this.authService.logout(refreshToken);
  }

  private setRefreshTokenCookie(res: Response, refreshToken: string) {
    res.cookie(REFRESH_TOKEN_KEY, refreshToken, {
      httpOnly: true,
      secure: IsProduction,
      maxAge: getConfig(this.configService).jwt.refreshExpiresIn * 1000,
    });
  }
}
