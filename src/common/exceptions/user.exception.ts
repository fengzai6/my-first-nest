import { HttpStatus } from '@nestjs/common';
import { ExceptionInfo } from './base.exception';

export const UserExceptionCode = {
  USER_NOT_FOUND: '11401',
  USER_ALREADY_EXISTS: '11402',
  NEW_PASSWORD_SAME_AS_OLD: '11403',
  SUPER_ADMIN_IS_SPECIAL: '11404',
} as const;

export type UserExceptionCode =
  (typeof UserExceptionCode)[keyof typeof UserExceptionCode];

export const UserExceptionMap: Record<UserExceptionCode, ExceptionInfo> = {
  [UserExceptionCode.USER_NOT_FOUND]: {
    message: '用户不存在',
    status: HttpStatus.NOT_FOUND,
    code: UserExceptionCode.USER_NOT_FOUND,
  },
  [UserExceptionCode.USER_ALREADY_EXISTS]: {
    message: '用户名或邮箱已存在',
    status: HttpStatus.BAD_REQUEST,
    code: UserExceptionCode.USER_ALREADY_EXISTS,
  },
  [UserExceptionCode.NEW_PASSWORD_SAME_AS_OLD]: {
    message: '新密码与旧密码相同',
    status: HttpStatus.BAD_REQUEST,
    code: UserExceptionCode.NEW_PASSWORD_SAME_AS_OLD,
  },
  [UserExceptionCode.SUPER_ADMIN_IS_SPECIAL]: {
    message: '超级管理员十分特殊喔',
    status: HttpStatus.BAD_REQUEST,
    code: UserExceptionCode.SUPER_ADMIN_IS_SPECIAL,
  },
};
