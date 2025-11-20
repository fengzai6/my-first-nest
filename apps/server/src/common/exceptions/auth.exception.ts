import { HttpStatus } from '@nestjs/common';
import { ExceptionInfo } from './base.exception';

export const AuthExceptionCode = {
  INVALID_CREDENTIALS: '10401',
  UNAUTHORIZED: '10402',
  INVALID_REFRESH_TOKEN: '10403',
} as const;

export type AuthExceptionCode =
  (typeof AuthExceptionCode)[keyof typeof AuthExceptionCode];

export const AuthExceptionMap: Record<AuthExceptionCode, ExceptionInfo> = {
  [AuthExceptionCode.INVALID_CREDENTIALS]: {
    message: '用户名或密码错误',
    status: HttpStatus.UNAUTHORIZED,
    code: AuthExceptionCode.INVALID_CREDENTIALS,
  },
  [AuthExceptionCode.UNAUTHORIZED]: {
    message: '未授权访问',
    status: HttpStatus.UNAUTHORIZED,
    code: AuthExceptionCode.UNAUTHORIZED,
  },
  [AuthExceptionCode.INVALID_REFRESH_TOKEN]: {
    message: '无效的刷新令牌',
    status: HttpStatus.UNAUTHORIZED,
    code: AuthExceptionCode.INVALID_REFRESH_TOKEN,
  },
};
