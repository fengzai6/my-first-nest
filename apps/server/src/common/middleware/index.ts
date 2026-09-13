import { INestApplication } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { requestContextMiddleware } from './request-context.middleware';

export const useMiddleware = (app: INestApplication) => {
  // 注册 cookie 解析中间件
  app.use(cookieParser());
  app.use(requestContextMiddleware);
};
