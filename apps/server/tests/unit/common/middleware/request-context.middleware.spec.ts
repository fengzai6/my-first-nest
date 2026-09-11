import { requestContextStorage } from '@/common/context/request-context';
import { requestContextMiddleware } from '@/common/middleware/request-context.middleware';
import { NextFunction, Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';

describe('requestContextMiddleware', () => {
  it('creates one request context before calling next', () => {
    const next = vi.fn(() => {
      const context = requestContextStorage.getStore();

      expect(context).toMatchObject({
        method: 'GET',
        url: '/api/logs?level=error',
        ip: '127.0.0.1',
      });
      expect(context?.startedAt).toEqual(expect.any(Number));
      expect(context?.requestId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      );
    });

    requestContextMiddleware(
      {
        method: 'GET',
        originalUrl: '/api/logs?level=error',
        ip: '127.0.0.1',
      } as Request,
      {} as Response,
      next as unknown as NextFunction,
    );

    expect(next).toHaveBeenCalledOnce();
    expect(requestContextStorage.getStore()).toBeUndefined();
  });
});
