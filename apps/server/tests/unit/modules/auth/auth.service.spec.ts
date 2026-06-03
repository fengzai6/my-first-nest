import { BaseException } from '@/common/exceptions/base.exception';
import {
  ErrorException,
  ErrorExceptionCode,
} from '@/common/exceptions/error.exception';
import { User } from '@/modules/users/entities/user.entity';
import { UsersService } from '@/modules/users/users.service';
import { AuthService } from '@/modules/auth/auth.service';
import { RefreshTokenService } from '@/modules/auth/refresh-token.service';
import { beforeEach, describe, expect, it, MockInstance, vi } from 'vitest';

vi.mock('argon2', () => ({
  verify: vi.fn((hashValue: string, value: string) =>
    Promise.resolve(hashValue === `hashed:${value}`),
  ),
}));

type MockUsersService = {
  create: MockInstance<(value: Partial<User>) => Promise<Partial<User>>>;
  findOne: MockInstance<(value: Partial<User>) => Promise<User>>;
};

type MockRefreshTokenService = {
  create: MockInstance<
    (user: User) => Promise<{
      accessToken: string;
      refreshToken: string;
      accessExpiresAt: number;
      refreshExpiresAt: Date;
    }>
  >;
  remove: MockInstance<(token: string) => Promise<void>>;
};

const createUser = () => {
  const user = new User();
  user.id = 'user-id';
  user.username = 'fengzai';
  user.password = 'hashed:password123';
  return user;
};

const createService = () => {
  const usersService: MockUsersService = {
    create: vi.fn((value: Partial<User>) => Promise.resolve(value)),
    findOne: vi.fn(),
  };
  const refreshTokenService: MockRefreshTokenService = {
    create: vi.fn(() =>
      Promise.resolve({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        accessExpiresAt: 1000,
        refreshExpiresAt: new Date('2026-01-01T00:00:00.000Z'),
      }),
    ),
    remove: vi.fn(() => Promise.resolve()),
  };

  return {
    usersService,
    refreshTokenService,
    service: new AuthService(
      usersService as unknown as UsersService,
      refreshTokenService as unknown as RefreshTokenService,
    ),
  };
};

describe('AuthService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should delegate signup to users service', async () => {
    const { service, usersService } = createService();
    const signupDto = {
      username: 'fengzai',
      email: 'test@test.com',
      password: 'password123',
    };

    await expect(service.signup(signupDto)).resolves.toBe(signupDto);
    expect(usersService.create).toHaveBeenCalledWith(signupDto);
  });

  it('should create tokens when username and password are valid', async () => {
    const { service, usersService, refreshTokenService } = createService();
    const user = createUser();

    usersService.findOne.mockResolvedValue(user);

    const result = await service.login({
      username: 'fengzai',
      password: 'password123',
    });

    expect(usersService.findOne).toHaveBeenCalledWith({ username: 'fengzai' });
    expect(refreshTokenService.create).toHaveBeenCalledWith(user);
    expect(result).toMatchObject({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      accessExpiresAt: 1000,
    });
  });

  it('should hide missing user as invalid credentials', async () => {
    const { service, usersService, refreshTokenService } = createService();

    usersService.findOne.mockRejectedValue(
      new ErrorException(ErrorExceptionCode.USER_NOT_FOUND),
    );

    await expect(
      service.login({
        username: 'missing-user',
        password: 'password123',
      }),
    ).rejects.toMatchObject({
      code: ErrorExceptionCode.INVALID_CREDENTIALS,
    });
    expect(refreshTokenService.create).not.toHaveBeenCalled();
  });

  it('should keep unexpected user lookup errors unchanged', async () => {
    const { service, usersService } = createService();
    const error = new Error('database down');

    usersService.findOne.mockRejectedValue(error);

    await expect(
      service.login({
        username: 'fengzai',
        password: 'password123',
      }),
    ).rejects.toBe(error);
  });

  it('should reject invalid password as invalid credentials', async () => {
    const { service, usersService, refreshTokenService } = createService();

    usersService.findOne.mockResolvedValue(createUser());

    await expect(
      service.login({
        username: 'fengzai',
        password: 'wrong-password',
      }),
    ).rejects.toMatchObject({
      code: ErrorExceptionCode.INVALID_CREDENTIALS,
    });
    expect(refreshTokenService.create).not.toHaveBeenCalled();
  });

  it('should remove refresh token on logout', async () => {
    const { service, refreshTokenService } = createService();

    const response = await service.logout('refresh-token');

    expect(refreshTokenService.remove).toHaveBeenCalledWith('refresh-token');
    expect(response.message).toBe('Logout successfully');
  });

  it('should convert only BaseException user not found errors', async () => {
    const { service, usersService } = createService();
    const error = {
      code: ErrorExceptionCode.USER_NOT_FOUND,
    };

    usersService.findOne.mockRejectedValue(error);

    await expect(
      service.login({
        username: 'fengzai',
        password: 'password123',
      }),
    ).rejects.toBe(error);
    expect(error).not.toBeInstanceOf(BaseException);
  });
});
