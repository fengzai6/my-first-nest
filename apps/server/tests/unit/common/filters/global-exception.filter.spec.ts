import { GlobalExceptionsFilter } from '@/common/filters/global-exception.filter';
import {
  requestContextStorage,
  type IRequestContext,
} from '@/common/context/request-context';
import {
  ErrorException,
  ErrorExceptionCode,
} from '@/common/exceptions/error.exception';
import { LOG_CATEGORY } from '@/shared/log/constants/log.constants';
import type { ILogWriteOptions } from '@/shared/log/interfaces/log.interface';
import { ArgumentsHost, BadRequestException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const createHost = () => {
  const json = vi.fn();
  const status = vi.fn(() => ({ json }));
  const request = {
    method: 'GET',
    originalUrl: '/api/test',
    url: '/api/test',
    ip: '127.0.0.1',
  };
  const host = {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => ({ status }),
    }),
  } as unknown as ArgumentsHost;

  return { host, json, status };
};

const createFilter = () => {
  const logger = {
    error:
      vi.fn<
        (message: string, error?: unknown, options?: ILogWriteOptions) => void
      >(),
  };

  return {
    filter: new GlobalExceptionsFilter(logger as never),
    logger,
  };
};

describe('GlobalExceptionsFilter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should format custom base exception', () => {
    const { filter } = createFilter();
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
    const { filter } = createFilter();
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
    const { filter, logger } = createFilter();
    const { host, json, status } = createHost();
    const requestContext: IRequestContext = {
      requestId: 'request-id',
      startedAt: 0,
      method: 'GET',
      url: '/api/test',
      ip: '127.0.0.1',
    };

    requestContextStorage.run(requestContext, () =>
      filter.catch(new Error('boom'), host),
    );

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'Error',
        message: 'boom',
      }),
    );
    expect(logger.error).toHaveBeenCalledWith(
      'HTTP request failed',
      expect.any(Error),
      expect.objectContaining({
        category: LOG_CATEGORY.HTTP,
        statusCode: 500,
        context: { code: 'Error' },
      }),
    );
    expect(logger.error.mock.calls[0]?.[2]?.duration).toEqual(
      expect.any(Number),
    );
  });
});
