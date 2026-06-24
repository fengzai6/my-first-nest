import { TokenType } from '@/common/constants/auth';
import { ErrorExceptionCode } from '@/common/exceptions/error.exception';
import { User } from '@/modules/users/entities/user.entity';
import { UsersService } from '@/modules/users/users.service';
import { RefreshToken } from '@/modules/auth/entities/refresh-token.entity';
import { RefreshTokenService } from '@/modules/auth/refresh-token.service';
import { CacheKeys } from '@/shared/caching/cache.constants';
import { CacheService } from '@/shared/caching/cache.service';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  MockInstance,
  vi,
} from 'vitest';

type TokenUpdate = {
  token: string;
  expiresAt: Date;
};

type MockRepository = {
  create: MockInstance<(value: Partial<RefreshToken>) => RefreshToken>;
  delete: MockInstance<(value: { token: string }) => Promise<void>>;
  findOne: MockInstance<
    (value: {
      where: { token: string };
      relations: string[];
    }) => Promise<RefreshToken | null>
  >;
  remove: MockInstance<(value: RefreshToken) => Promise<RefreshToken>>;
  save: MockInstance<(value: RefreshToken) => Promise<RefreshToken>>;
  update: MockInstance<
    (
      idOrCriteria: string | { token: string },
      value: TokenUpdate,
    ) => Promise<{ affected: number }>
  >;
};

type MockJwtService = {
  sign: MockInstance<
    (
      payload: {
        sub: string;
        type: TokenType;
      },
      options?: {
        expiresIn: number;
      },
    ) => string
  >;
};

type MockCacheService = {
  del: MockInstance<(key: string) => Promise<boolean>>;
  get: MockInstance<(key: string) => Promise<string | undefined>>;
  isRedisEnabled: MockInstance<() => boolean>;
  rotateRefreshToken: MockInstance<
    (
      oldKey: string,
      newKey: string,
      expectedValue: string,
      ttlSeconds: number,
    ) => Promise<boolean>
  >;
  set: MockInstance<
    (key: string, value: string, ttlSeconds: number) => Promise<string>
  >;
};

type MockUsersService = {
  findOne: MockInstance<(value: { id: string }) => Promise<User>>;
};

const BASE_TIME = new Date('2026-01-01T00:00:00.000Z');

const createUser = (id = 'user-id') => {
  const user = new User();
  user.id = id;
  user.username = 'fengzai';
  return user;
};

const createRefreshToken = ({
  id = 'refresh-token-id',
  token = 'old-refresh-token',
  expiresAt = new Date('2026-01-01T00:30:00.000Z'),
  user = createUser(),
}: Partial<RefreshToken> = {}) => {
  const refreshToken = new RefreshToken();
  refreshToken.id = id;
  refreshToken.token = token;
  refreshToken.expiresAt = expiresAt;
  refreshToken.user = user;
  return refreshToken;
};

const createRepository = (): MockRepository => ({
  create: vi.fn((value: Partial<RefreshToken>) =>
    Object.assign(new RefreshToken(), value),
  ),
  delete: vi.fn(() => Promise.resolve()),
  findOne: vi.fn(),
  remove: vi.fn((value: RefreshToken) => Promise.resolve(value)),
  save: vi.fn((value: RefreshToken) => Promise.resolve(value)),
  update: vi.fn(() => Promise.resolve({ affected: 1 })),
});

const createConfigService = () =>
  ({
    get: vi.fn((key: string) => {
      if (key === 'default') {
        return {
          jwt: {
            accessExpiresIn: 3600,
            refreshExpiresIn: 7200,
          },
        };
      }

      if (key === 'development') {
        return {
          jwt: {
            accessExpiresIn: 60,
            refreshExpiresIn: 120,
          },
        };
      }

      return undefined;
    }),
  }) as unknown as ConfigService;

const createService = ({ redisEnabled = false } = {}) => {
  const repository = createRepository();
  const jwtService: MockJwtService = {
    sign: vi.fn((payload) => `${payload.type}-token-for-${payload.sub}`),
  };
  const cacheService: MockCacheService = {
    del: vi.fn(() => Promise.resolve(true)),
    get: vi.fn(),
    isRedisEnabled: vi.fn(() => redisEnabled),
    rotateRefreshToken: vi.fn(() => Promise.resolve(true)),
    set: vi.fn((_, value: string) => Promise.resolve(value)),
  };
  const usersService: MockUsersService = {
    findOne: vi.fn(),
  };

  return {
    repository,
    jwtService,
    cacheService,
    usersService,
    service: new RefreshTokenService(
      repository as never,
      jwtService as unknown as JwtService,
      createConfigService(),
      cacheService as unknown as CacheService,
      usersService as unknown as UsersService,
    ),
  };
};

describe('RefreshTokenService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(BASE_TIME);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should generate access and refresh tokens with configured expiration', () => {
    const { service, jwtService } = createService();

    const result = service.generateTokens(createUser());

    expect(jwtService.sign).toHaveBeenNthCalledWith(1, {
      sub: 'user-id',
      type: TokenType.ACCESS,
    });
    expect(jwtService.sign).toHaveBeenNthCalledWith(
      2,
      {
        sub: 'user-id',
        type: TokenType.REFRESH,
      },
      {
        expiresIn: 120,
      },
    );
    expect(result).toEqual({
      accessToken: 'access-token-for-user-id',
      refreshToken: 'refresh-token-for-user-id',
      accessExpiresAt: BASE_TIME.getTime() + 60_000,
      refreshExpiresAt: new Date(BASE_TIME.getTime() + 120_000),
    });
  });

  it('should persist refresh token when creating tokens without redis', async () => {
    const { service, repository, cacheService } = createService();
    const user = createUser();

    const result = await service.create(user);

    expect(cacheService.set).not.toHaveBeenCalled();
    expect(repository.create).toHaveBeenCalledWith({
      token: 'refresh-token-for-user-id',
      expiresAt: new Date(BASE_TIME.getTime() + 120_000),
      user,
    });
    expect(repository.save).toHaveBeenCalledTimes(1);
    expect(result.refreshToken).toBe('refresh-token-for-user-id');
  });

  it('should cache refresh token when creating tokens with redis', async () => {
    const { service, cacheService } = createService({ redisEnabled: true });

    await service.create(createUser());

    expect(cacheService.set).toHaveBeenCalledWith(
      CacheKeys.AUTH_REFRESH_TOKEN('refresh-token-for-user-id'),
      'user-id',
      120,
    );
  });

  it('should reject missing refresh token', async () => {
    const { service } = createService();

    await expect(service.refreshToken(undefined)).rejects.toMatchObject({
      code: ErrorExceptionCode.INVALID_REFRESH_TOKEN,
    });
  });

  it('should rotate valid refresh token through database fallback', async () => {
    const { service, repository } = createService();

    repository.findOne.mockResolvedValue(createRefreshToken());

    const result = await service.refreshToken('old-refresh-token');

    expect(repository.findOne).toHaveBeenCalledWith({
      where: { token: 'old-refresh-token' },
      relations: ['user'],
    });
    expect(repository.update).toHaveBeenCalledWith('refresh-token-id', {
      token: 'refresh-token-for-user-id',
      expiresAt: new Date(BASE_TIME.getTime() + 120_000),
    });
    expect(result.accessToken).toBe('access-token-for-user-id');
  });

  it('should reject unknown database refresh token', async () => {
    const { service, repository } = createService();

    repository.findOne.mockResolvedValue(null);

    await expect(service.refreshToken('missing-token')).rejects.toMatchObject({
      code: ErrorExceptionCode.INVALID_REFRESH_TOKEN,
    });
    expect(repository.update).not.toHaveBeenCalled();
  });

  it('should remove expired database refresh token before rejecting it', async () => {
    const { service, repository } = createService();
    const expiredToken = createRefreshToken({
      expiresAt: new Date('2025-12-31T23:59:00.000Z'),
    });

    repository.findOne.mockResolvedValue(expiredToken);

    await expect(
      service.refreshToken('old-refresh-token'),
    ).rejects.toMatchObject({
      code: ErrorExceptionCode.INVALID_REFRESH_TOKEN,
    });
    expect(repository.remove).toHaveBeenCalledWith(expiredToken);
  });

  it('should remove token string from database and redis', async () => {
    const { service, repository, cacheService } = createService({
      redisEnabled: true,
    });

    await service.remove('old-refresh-token');

    expect(cacheService.del).toHaveBeenCalledWith(
      CacheKeys.AUTH_REFRESH_TOKEN('old-refresh-token'),
    );
    expect(repository.delete).toHaveBeenCalledWith({
      token: 'old-refresh-token',
    });
  });

  it('should remove token entity from database and redis', async () => {
    const { service, repository, cacheService } = createService({
      redisEnabled: true,
    });
    const token = createRefreshToken();

    await service.remove(token);

    expect(cacheService.del).toHaveBeenCalledWith(
      CacheKeys.AUTH_REFRESH_TOKEN('old-refresh-token'),
    );
    expect(repository.remove).toHaveBeenCalledWith(token);
  });

  it('should fallback to database refresh when redis misses token', async () => {
    const { service, repository, cacheService, usersService } = createService({
      redisEnabled: true,
    });

    cacheService.get.mockResolvedValue(undefined);
    repository.findOne.mockResolvedValue(createRefreshToken());

    await service.refreshToken('old-refresh-token');

    expect(repository.findOne).toHaveBeenCalledTimes(1);
    expect(usersService.findOne).not.toHaveBeenCalled();
  });

  it('should rotate refresh token through redis when cache has user id', async () => {
    const { service, repository, cacheService, usersService } = createService({
      redisEnabled: true,
    });
    const user = createUser();

    cacheService.get.mockResolvedValue('user-id');
    usersService.findOne.mockResolvedValue(user);

    const result = await service.refreshToken('old-refresh-token');

    expect(usersService.findOne).toHaveBeenCalledWith({ id: 'user-id' });
    expect(cacheService.rotateRefreshToken).toHaveBeenCalledWith(
      CacheKeys.AUTH_REFRESH_TOKEN('old-refresh-token'),
      CacheKeys.AUTH_REFRESH_TOKEN('refresh-token-for-user-id'),
      'user-id',
      120,
    );
    expect(repository.update).toHaveBeenCalledWith(
      { token: 'old-refresh-token' },
      {
        token: 'refresh-token-for-user-id',
        expiresAt: new Date(BASE_TIME.getTime() + 120_000),
      },
    );
    expect(result.refreshToken).toBe('refresh-token-for-user-id');
  });

  it('should reject redis refresh when cached user is missing', async () => {
    const { service, cacheService, usersService, repository } = createService({
      redisEnabled: true,
    });

    cacheService.get.mockResolvedValue('missing-user-id');
    usersService.findOne.mockRejectedValue(new Error('missing user'));

    await expect(
      service.refreshToken('old-refresh-token'),
    ).rejects.toMatchObject({
      code: ErrorExceptionCode.INVALID_REFRESH_TOKEN,
    });
    expect(cacheService.del).toHaveBeenCalledWith(
      CacheKeys.AUTH_REFRESH_TOKEN('old-refresh-token'),
    );
    expect(repository.update).not.toHaveBeenCalled();
  });

  it('should reject redis refresh when token rotation fails', async () => {
    const { service, cacheService, usersService, repository } = createService({
      redisEnabled: true,
    });

    cacheService.get.mockResolvedValue('user-id');
    usersService.findOne.mockResolvedValue(createUser());
    cacheService.rotateRefreshToken.mockResolvedValue(false);

    await expect(
      service.refreshToken('old-refresh-token'),
    ).rejects.toMatchObject({
      code: ErrorExceptionCode.INVALID_REFRESH_TOKEN,
    });
    expect(repository.update).not.toHaveBeenCalled();
  });
});
