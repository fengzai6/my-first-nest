import { TokenType } from '@/common/constants/auth';
import { ErrorExceptionCode } from '@/common/exceptions/error.exception';
import { JwtAuthStrategy } from '@/modules/auth/strategies/jwt-auth.strategy';
import { User } from '@/modules/users/entities/user.entity';
import { UsersService } from '@/modules/users/users.service';
import { ConfigService } from '@nestjs/config';
import { beforeEach, describe, expect, it, MockInstance, vi } from 'vitest';

type MockUsersService = {
  findOne: MockInstance<(criteria: { id: string }) => Promise<User>>;
};

const createConfigService = () =>
  ({
    get: vi.fn((key: string) => {
      if (key === 'default') {
        return { jwt: { secret: 'secret' } };
      }
      if (key === 'development') {
        return { jwt: {} };
      }
      return undefined;
    }),
  }) as unknown as ConfigService;

const createUser = () => {
  const user = new User();
  user.id = 'user-id';
  return user;
};

const createStrategy = () => {
  const usersService: MockUsersService = {
    findOne: vi.fn(() => Promise.resolve(createUser())),
  };

  return {
    usersService,
    strategy: new JwtAuthStrategy(
      createConfigService(),
      usersService as unknown as UsersService,
    ),
  };
};

describe('JwtAuthStrategy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should validate access token payload and return user', async () => {
    const { strategy, usersService } = createStrategy();

    const user = await strategy.validate({
      sub: 'user-id',
      type: TokenType.ACCESS,
    });

    expect(usersService.findOne).toHaveBeenCalledWith({ id: 'user-id' });
    expect(user.id).toBe('user-id');
  });

  it('should reject non-access token payload', async () => {
    const { strategy, usersService } = createStrategy();

    await expect(
      strategy.validate({
        sub: 'user-id',
        type: TokenType.REFRESH,
      }),
    ).rejects.toMatchObject({
      code: ErrorExceptionCode.UNAUTHORIZED,
    });
    expect(usersService.findOne).not.toHaveBeenCalled();
  });
});
