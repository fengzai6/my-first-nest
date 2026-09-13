import { requestContextStorage } from '@/common/context/request-context';
import { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';

export const requestContextMiddleware = (
  req: Request,
  _res: Response,
  next: NextFunction,
): void => {
  // NOTE: 只有 HTTP 链路经过这里；cron、BullMQ processor、WebSocket 处理函数里 getStore() 为 undefined，日志的 requestId 等字段会落成 null。
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
