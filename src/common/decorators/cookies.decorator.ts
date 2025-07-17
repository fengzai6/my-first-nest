import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

/**
 * 获取 cookies
 * @param data 获取指定 cookie 的值
 * @returns 返回 cookies 对象或指定 cookie 的值
 */
export const Cookies = createParamDecorator(
  (data: string, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<Request>();
    return data
      ? (request.cookies?.[data] as string | undefined)
      : (request.cookies as Record<string, string>);
  },
);
