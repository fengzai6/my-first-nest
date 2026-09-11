import { requestContextStorage } from '@/common/context/request-context';
import { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';

export const requestContextMiddleware = (
  req: Request,
  _res: Response,
  next: NextFunction,
): void => {
  requestContextStorage.run(
    {
      requestId: randomUUID(),
      startedAt: Date.now(),
      method: req.method,
      url: req.originalUrl ?? req.url,
      ip: req.ip ?? 'unknown',
    },
    next,
  );
};
