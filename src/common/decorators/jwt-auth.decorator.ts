import {
  createParamDecorator,
  ExecutionContext,
  SetMetadata,
} from '@nestjs/common';
import { Request } from 'express';

/**
 * 访问权限的元数据的key
 */
export const JWT_META_KEY = 'JWT_META_KEY' as const;

/**
 * jwt元数据
 */
export enum JwtMetaEnum {
  PUBLIC,
}

/**
 * 跳过jwt检查
 */
export const Public = () => SetMetadata(JWT_META_KEY, JwtMetaEnum.PUBLIC);

/**
 * 获取JWT解密后注入的用户信息
 */
export const UserInfo = createParamDecorator(
  (_: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<Request>();
    return request.user;
  },
);
