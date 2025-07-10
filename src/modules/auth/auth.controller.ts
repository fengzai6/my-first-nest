import { IsProduction } from '@/common/constants';
import { Cookies } from '@/common/decorators/cookies.decorator';
import { Public } from '@/common/decorators/jwt-auth.decorator';
import { getConfig } from '@/config/configuration';
import { Body, Controller, Get, Post, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOperation } from '@nestjs/swagger';
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
  @Get('refresh-token')
  async refreshToken(
    @Cookies('refreshToken') refreshToken: string,
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
  @Post('logout')
  logout(
    @Cookies('refreshToken') refreshToken: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.clearCookie('refreshToken');

    return this.authService.logout(refreshToken);
  }

  private setRefreshTokenCookie(res: Response, refreshToken: string) {
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: IsProduction,
      maxAge: getConfig(this.configService).jwt.refreshExpiresIn * 1000,
    });
  }
}
