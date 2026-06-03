import {
  LoggerMiddleware,
  logger,
} from '@/common/middleware/logger.middleware';
import { Logger } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const createRequest = () =>
  ({
    baseUrl: '/api/test',
    body: { name: 'test' },
    headers: { 'x-test': '1' },
    ip: '127.0.0.1',
    method: 'GET',
    params: { id: '1' },
    protocol: 'http',
    query: { page: '1' },
    url: '/api/test?id=1',
  }) as unknown as Request;

describe('LoggerMiddleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should log request details and call next', () => {
    const log = vi.spyOn(Logger, 'log').mockImplementation(() => undefined);
    const next = vi.fn() as NextFunction;

    new LoggerMiddleware().use(createRequest(), {} as Response, next);

    expect(log).toHaveBeenCalledWith(
      expect.stringContaining('Request details:'),
    );
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('should log simple request line and call next', () => {
    const log = vi.spyOn(Logger, 'log').mockImplementation(() => undefined);
    const next = vi.fn() as NextFunction;

    logger(createRequest(), {} as Response, next);

    expect(log).toHaveBeenCalledWith(expect.stringContaining('Method:'));
    expect(next).toHaveBeenCalledTimes(1);
  });
});
