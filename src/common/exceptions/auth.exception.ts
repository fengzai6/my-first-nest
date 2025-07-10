import { HttpStatus } from '@nestjs/common';
import { BaseException, ExceptionInfo } from './base.exception';

export enum AuthExceptionCode {
  USER_NOT_FOUND = 'USER_NOT_FOUND',
  USER_ALREADY_EXISTS = 'USER_ALREADY_EXISTS',
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  NEW_PASSWORD_SAME_AS_OLD = 'NEW_PASSWORD_SAME_AS_OLD',
  UNAUTHORIZED = 'UNAUTHORIZED',
  INVALID_REFRESH_TOKEN = 'INVALID_REFRESH_TOKEN',
  SUPER_ADMIN_IS_SPECIAL = 'SUPER_ADMIN_IS_SPECIAL',
}

export const AuthExceptionMap: Record<AuthExceptionCode, ExceptionInfo> = {
  [AuthExceptionCode.USER_NOT_FOUND]: {
    message: '用户不存在',
    status: HttpStatus.NOT_FOUND,
    code: AuthExceptionCode.USER_NOT_FOUND,
  },
  [AuthExceptionCode.USER_ALREADY_EXISTS]: {
    message: '用户名或邮箱已存在',
    status: HttpStatus.BAD_REQUEST,
    code: AuthExceptionCode.USER_ALREADY_EXISTS,
  },
  [AuthExceptionCode.INVALID_CREDENTIALS]: {
    message: '用户名或密码错误',
    status: HttpStatus.UNAUTHORIZED,
    code: AuthExceptionCode.INVALID_CREDENTIALS,
  },
  [AuthExceptionCode.NEW_PASSWORD_SAME_AS_OLD]: {
    message: '新密码与旧密码相同',
    status: HttpStatus.BAD_REQUEST,
    code: AuthExceptionCode.NEW_PASSWORD_SAME_AS_OLD,
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
  [AuthExceptionCode.SUPER_ADMIN_IS_SPECIAL]: {
    message: '超级管理员十分特殊喔',
    status: HttpStatus.BAD_REQUEST,
    code: AuthExceptionCode.SUPER_ADMIN_IS_SPECIAL,
  },
};

export class AuthException extends BaseException {
  constructor(errorCode: AuthExceptionCode) {
    const exception = AuthExceptionMap[errorCode];
    super(exception);
  }
}
