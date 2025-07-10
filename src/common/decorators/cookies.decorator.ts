import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * 获取 cookies
 * @param data 获取指定 cookie 的值
 * @returns 返回 cookies 对象或指定 cookie 的值
 */
export const Cookies = createParamDecorator(
  (data: string, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return data ? request.cookies?.[data] : request.cookies;
  },
);
