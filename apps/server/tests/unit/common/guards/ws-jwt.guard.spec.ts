import { TokenType } from '@/common/constants/auth';
import { WsJwtGuard } from '@/common/guards/ws-jwt.guard';
import { AuthSocket } from '@/modules/socket/interface/auth-socket';
import { User } from '@/modules/users/entities/user.entity';
import { UsersService } from '@/modules/users/users.service';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { WsException } from '@nestjs/websockets';
import { ExecutionContext } from '@nestjs/common';
import { beforeEach, describe, expect, it, MockInstance, vi } from 'vitest';

type MockJwtService = {
  verify: MockInstance<
    (
      token: string,
      options: {
        secret: string;
      },
    ) => {
      sub: string;
      type: TokenType;
    }
  >;
};

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

const createContext = (client: AuthSocket) =>
  ({
    switchToWs: () => ({
      getClient: () => client,
    }),
  }) as unknown as ExecutionContext;

const createSocket = (token?: string) =>
  ({
    handshake: {
      auth: { token },
      headers: {},
    },
  }) as unknown as AuthSocket;

const createGuard = () => {
  const jwtService: MockJwtService = {
    verify: vi.fn(() => ({
      sub: 'user-id',
      type: TokenType.ACCESS,
    })),
  };
  const usersService: MockUsersService = {
    findOne: vi.fn(() => Promise.resolve(createUser())),
  };

  return {
    guard: new WsJwtGuard(
      jwtService as unknown as JwtService,
      createConfigService(),
      usersService as unknown as UsersService,
    ),
    jwtService,
    usersService,
  };
};

describe('WsJwtGuard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should attach user to socket when access token is valid', async () => {
    const { guard, usersService } = createGuard();
    const client = createSocket('access-token');

    await expect(guard.canActivate(createContext(client))).resolves.toBe(true);
    expect(usersService.findOne).toHaveBeenCalledWith({ id: 'user-id' });
    expect(client.user?.id).toBe('user-id');
  });

  it('should reject missing token', async () => {
    const { guard } = createGuard();

    await expect(
      guard.canActivate(createContext(createSocket())),
    ).rejects.toBeInstanceOf(WsException);
  });

  it('should reject invalid token', async () => {
    const { guard, jwtService } = createGuard();

    jwtService.verify.mockImplementation(() => {
      throw new Error('invalid');
    });

    await expect(
      guard.canActivate(createContext(createSocket('bad-token'))),
    ).rejects.toMatchObject({
      error: {
        status: 401,
        message: 'Invalid token',
      },
    });
  });

  it('should reject refresh token', async () => {
    const { guard, jwtService } = createGuard();

    jwtService.verify.mockReturnValue({
      sub: 'user-id',
      type: TokenType.REFRESH,
    });

    await expect(
      guard.canActivate(createContext(createSocket('refresh-token'))),
    ).rejects.toMatchObject({
      error: {
        status: 401,
        message: 'Invalid token type',
      },
    });
  });
});
