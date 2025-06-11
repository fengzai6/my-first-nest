import { HttpException, HttpStatus } from '@nestjs/common';

export enum AuthExceptionCode {
  USER_NOT_FOUND,
  USER_ALREADY_EXISTS,
  INVALID_CREDENTIALS,
  UNAUTHORIZED,
}

export const AuthExceptionMap = {
  [AuthExceptionCode.USER_NOT_FOUND]: {
    message: '用户不存在',
    status: HttpStatus.NOT_FOUND,
  },
  [AuthExceptionCode.USER_ALREADY_EXISTS]: {
    message: '用户名已存在',
    status: HttpStatus.BAD_REQUEST,
  },
  [AuthExceptionCode.INVALID_CREDENTIALS]: {
    message: '用户名或密码错误',
    status: HttpStatus.UNAUTHORIZED,
  },
  [AuthExceptionCode.UNAUTHORIZED]: {
    message: '未授权访问',
    status: HttpStatus.UNAUTHORIZED,
  },
} as const;

export class AuthException extends HttpException {
  constructor(errorCode: AuthExceptionCode) {
    const exception = AuthExceptionMap[errorCode];
    super(exception.message, exception.status);
  }
}
