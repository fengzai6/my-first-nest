import { INestApplication } from '@nestjs/common';
import * as cookieParser from 'cookie-parser';

export const useMiddleware = (app: INestApplication) => {
  // 注册 cookie 解析中间件
  app.use(cookieParser());
  // app.use(new LoggerMiddleware().use);
};
