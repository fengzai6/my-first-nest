import { TokenType } from '@/common/constants/auth';
import { JobBoardAuthMiddleware } from '@/shared/jobs/board/job-board.auth.middleware';
import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UsersService } from '@/modules/users/users.service';

const createMiddleware = () => {
  const jwtService = {
    verify: vi.fn(),
  };
  const usersService = {
    findOne: vi.fn(),
  };
  const middleware = new JobBoardAuthMiddleware(
    jwtService as unknown as JwtService,
    usersService as unknown as UsersService,
  );

  return { middleware, jwtService, usersService };
};

const createResponse = () => {
  const status = vi.fn();
  const json = vi.fn();
  const response = {
    status,
    json,
  } as unknown as Response;
  status.mockReturnValue(response);
  json.mockReturnValue(response);

  return { response, status };
};

const createRequest = (authorization?: string) => {
  return {
    headers: authorization ? { authorization } : {},
    cookies: {},
  } as Request;
};

const createCookieRequest = (refreshToken: string) => {
  return {
    headers: {},
    cookies: { refreshToken },
  } as unknown as Request;
};

describe('JobBoardAuthMiddleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should reject request without bearer token', async () => {
    const { middleware } = createMiddleware();
    const { response, status } = createResponse();
    const next = vi.fn();

    await middleware.use(createRequest(), response, next);

    expect(status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('should reject refresh token', async () => {
    const { middleware, jwtService } = createMiddleware();
    const { response, status } = createResponse();
    const next = vi.fn();

    jwtService.verify.mockReturnValue({
      sub: 'user-1',
      type: TokenType.REFRESH,
    });

    await middleware.use(createRequest('Bearer token'), response, next);

    expect(status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('should allow valid refresh token cookie for browser board access', async () => {
    const { middleware, jwtService, usersService } = createMiddleware();
    const { response } = createResponse();
    const next = vi.fn();

    jwtService.verify.mockReturnValue({
      sub: 'user-1',
      type: TokenType.REFRESH,
    });
    usersService.findOne.mockResolvedValue({ id: 'user-1' });

    await middleware.use(createCookieRequest('refresh-token'), response, next);

    expect(usersService.findOne).toHaveBeenCalledWith({ id: 'user-1' });
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('should reject when user does not exist', async () => {
    const { middleware, jwtService, usersService } = createMiddleware();
    const { response, status } = createResponse();
    const next = vi.fn();

    jwtService.verify.mockReturnValue({
      sub: 'user-1',
      type: TokenType.ACCESS,
    });
    usersService.findOne.mockRejectedValue(new UnauthorizedException());

    await middleware.use(createRequest('Bearer token'), response, next);

    expect(status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('should allow valid access token', async () => {
    const { middleware, jwtService, usersService } = createMiddleware();
    const { response } = createResponse();
    const next = vi.fn();

    jwtService.verify.mockReturnValue({
      sub: 'user-1',
      type: TokenType.ACCESS,
    });
    usersService.findOne.mockResolvedValue({ id: 'user-1' });

    await middleware.use(createRequest('Bearer token'), response, next);

    expect(usersService.findOne).toHaveBeenCalledWith({ id: 'user-1' });
    expect(next).toHaveBeenCalledTimes(1);
  });
});
