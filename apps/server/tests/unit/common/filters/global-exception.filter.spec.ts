import { GlobalExceptionsFilter } from '@/common/filters/global-exception.filter';
import {
  ErrorException,
  ErrorExceptionCode,
} from '@/common/exceptions/error.exception';
import { ArgumentsHost, BadRequestException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const createHost = () => {
  const json = vi.fn();
  const status = vi.fn(() => ({ json }));
  const request = {
    method: 'GET',
    url: '/api/test',
  };
  const host = {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => ({ status }),
    }),
  } as unknown as ArgumentsHost;

  return { host, json, status };
};

describe('GlobalExceptionsFilter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should format custom base exception', () => {
    const filter = new GlobalExceptionsFilter();
    const { host, json, status } = createHost();

    filter.catch(new ErrorException(ErrorExceptionCode.USER_NOT_FOUND), host);

    expect(status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: ErrorExceptionCode.USER_NOT_FOUND,
        message: '用户不存在',
        path: '/api/test',
        statusCode: 404,
      }),
    );
  });

  it('should join validation exception messages', () => {
    const filter = new GlobalExceptionsFilter();
    const { host, json, status } = createHost();

    filter.catch(
      new BadRequestException({
        message: ['name should not be empty', 'age must be number'],
        error: 'Bad Request',
      }),
      host,
    );

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'Bad Request',
        message: 'name should not be empty, age must be number',
      }),
    );
  });

  it('should expose non-production error message for unknown errors', () => {
    const filter = new GlobalExceptionsFilter();
    const { host, json, status } = createHost();

    filter.catch(new Error('boom'), host);

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'Error',
        message: 'boom',
      }),
    );
  });
});
