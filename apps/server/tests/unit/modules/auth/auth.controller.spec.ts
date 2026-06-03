import { REFRESH_TOKEN_KEY } from '@/common/constants/auth';
import { AuthController } from '@/modules/auth/auth.controller';
import { AuthService } from '@/modules/auth/auth.service';
import { RefreshTokenService } from '@/modules/auth/refresh-token.service';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import { beforeEach, describe, expect, it, MockInstance, vi } from 'vitest';

type TokenResult = {
  accessToken: string;
  refreshToken: string;
  accessExpiresAt: number;
  refreshExpiresAt: Date;
};

type MockAuthService = {
  signup: MockInstance<(value: SignupInput) => Promise<SignupInput>>;
  login: MockInstance<(value: LoginInput) => Promise<TokenResult>>;
  logout: MockInstance<(value: string) => Promise<{ message: string }>>;
};

type MockRefreshTokenService = {
  refreshToken: MockInstance<
    (value: string | undefined) => Promise<TokenResult>
  >;
};

type LoginInput = {
  username: string;
  password: string;
};

type SignupInput = LoginInput & {
  email: string;
};

const createTokens = (refreshToken = 'new-refresh-token'): TokenResult => ({
  accessToken: 'access-token',
  refreshToken,
  accessExpiresAt: 1000,
  refreshExpiresAt: new Date('2026-01-01T00:00:00.000Z'),
});

const createResponse = () => ({
  cookie: vi.fn(),
  clearCookie: vi.fn(),
});

const createController = () => {
  const authService: MockAuthService = {
    signup: vi.fn((value: SignupInput) => Promise.resolve(value)),
    login: vi.fn(() => Promise.resolve(createTokens())),
    logout: vi.fn(() => Promise.resolve({ message: 'Logout successfully' })),
  };
  const refreshTokenService: MockRefreshTokenService = {
    refreshToken: vi.fn(() => Promise.resolve(createTokens('rotated-token'))),
  };
  const configService = {
    get: vi.fn((key: string) => {
      if (key === 'default') {
        return {
          jwt: {
            refreshExpiresIn: 3600,
          },
        };
      }

      if (key === 'development') {
        return {
          jwt: {
            refreshExpiresIn: 60,
          },
        };
      }

      return undefined;
    }),
  } as unknown as ConfigService;

  return {
    authService,
    refreshTokenService,
    configService,
    controller: new AuthController(
      authService as unknown as AuthService,
      refreshTokenService as unknown as RefreshTokenService,
      configService,
    ),
  };
};

describe('AuthController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should delegate signup to auth service', async () => {
    const { controller, authService } = createController();
    const signupDto = {
      username: 'fengzai',
      email: 'test@test.com',
      password: 'password123',
    };

    await expect(controller.signup(signupDto)).resolves.toBe(signupDto);
    expect(authService.signup).toHaveBeenCalledWith(signupDto);
  });

  it('should set refresh token cookie and return public login payload', async () => {
    const { controller, authService } = createController();
    const res = createResponse();
    const loginDto = {
      username: 'fengzai',
      password: 'password123',
    };

    const result = await controller.login(loginDto, res as unknown as Response);

    expect(authService.login).toHaveBeenCalledWith(loginDto);
    expect(res.cookie).toHaveBeenCalledWith(
      REFRESH_TOKEN_KEY,
      'new-refresh-token',
      {
        httpOnly: true,
        secure: false,
        maxAge: 60_000,
      },
    );
    expect(result).toEqual({
      accessToken: 'access-token',
      expiresAt: 1000,
    });
  });

  it('should rotate refresh token from cookie and return new access payload', async () => {
    const { controller, refreshTokenService } = createController();
    const res = createResponse();

    const result = await controller.refreshToken(
      'old-refresh-token',
      res as unknown as Response,
    );

    expect(refreshTokenService.refreshToken).toHaveBeenCalledWith(
      'old-refresh-token',
    );
    expect(res.cookie).toHaveBeenCalledWith(
      REFRESH_TOKEN_KEY,
      'rotated-token',
      expect.objectContaining({
        httpOnly: true,
        maxAge: 60_000,
      }),
    );
    expect(result).toEqual({
      accessToken: 'access-token',
      expiresAt: 1000,
    });
  });

  it('should pass missing refresh token to refresh token service', async () => {
    const { controller, refreshTokenService } = createController();
    const res = createResponse();

    await controller.refreshToken(undefined, res as unknown as Response);

    expect(refreshTokenService.refreshToken).toHaveBeenCalledWith(undefined);
  });

  it('should clear refresh token cookie before logout', async () => {
    const { controller, authService } = createController();
    const res = createResponse();

    const result = await controller.logout(
      'refresh-token',
      res as unknown as Response,
    );

    expect(res.clearCookie).toHaveBeenCalledWith(REFRESH_TOKEN_KEY);
    expect(authService.logout).toHaveBeenCalledWith('refresh-token');
    expect(result).toEqual({ message: 'Logout successfully' });
  });
});
