import { JwtMetaEnum } from '@/common/decorators/jwt-auth.decorator';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { User } from '@/modules/users/entities/user.entity';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const defaultHandler = () => undefined;

const createContext = ({
  type = 'http',
  handler = defaultHandler,
}: {
  type?: 'http' | 'ws';
  handler?: () => void;
} = {}) =>
  ({
    getHandler: () => handler,
    getType: () => type,
  }) as unknown as ExecutionContext;

const createUser = () => {
  const user = new User();
  user.id = 'user-id';
  user.username = 'fengzai';
  return user;
};

describe('JwtAuthGuard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should allow websocket context without passport auth', () => {
    const reflector = {
      get: vi.fn(),
    } as unknown as Reflector;
    const guard = new JwtAuthGuard(reflector);
    const context = createContext({ type: 'ws' });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('should allow public route metadata', () => {
    const reflector = {
      get: vi.fn(() => JwtMetaEnum.PUBLIC),
    } as unknown as Reflector;
    const guard = new JwtAuthGuard(reflector);
    const context = createContext();

    expect(guard.canActivate(context)).toBe(true);
  });

  it('should throw original auth error from handleRequest', () => {
    const guard = new JwtAuthGuard({} as Reflector);
    const error = new Error('auth failed');

    expect(() => guard.handleRequest(error, undefined, undefined)).toThrow(
      error,
    );
  });

  it('should throw unauthorized exception for passport info error', () => {
    const guard = new JwtAuthGuard({} as Reflector);

    expect(() =>
      guard.handleRequest(undefined, undefined, new Error('jwt expired')),
    ).toThrow(UnauthorizedException);
  });

  it('should return user from handleRequest', () => {
    const guard = new JwtAuthGuard({} as Reflector);
    const user = createUser();

    expect(guard.handleRequest(undefined, user, undefined)).toBe(user);
  });
});
