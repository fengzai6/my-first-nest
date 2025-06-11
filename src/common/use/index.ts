import { INestApplication } from '@nestjs/common';
import { useFilters } from '../filters';
import { useInterceptors } from '../interceptors';
import { useMiddleware } from '../middleware';
import { usePipes } from '../pipes';

export const appUse = (app: INestApplication) => {
  // 注册全局过滤器
  useFilters(app);

  // 注册全局拦截器
  useInterceptors(app);

  // 注册全局中间件
  useMiddleware(app);

  // 注册全局管道
  usePipes(app);
};
