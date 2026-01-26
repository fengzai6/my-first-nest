import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const requestLog = {
      method: req.method,
      url: req.url,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      body: req.body,
      headers: req.headers,
      params: req.params,
      query: req.query,
      timestamp: new Date().toISOString(),
      ip: req.ip,
      protocol: req.protocol,
    };

    // Log the entire object at once
    Logger.log(`Request details: ${JSON.stringify(requestLog)}`);

    next();
  }
}

export const logger = (req: Request, res: Response, next: NextFunction) => {
  Logger.log(
    `\x1b[33mMethod:\x1b[0m ${req.method}; \x1b[33mURL:\x1b[0m ${req.baseUrl}`,
  );

  next();
};
