import { AuthExceptionCode, AuthExceptionMap } from './auth.exception';
import { BaseException, ExceptionInfo } from './base.exception';
import { CatExceptionCode, CatExceptionMap } from './cat.exception';
import { GroupExceptionCode, GroupExceptionMap } from './group.exception';
import {
  PermissionExceptionCode,
  PermissionExceptionMap,
} from './permission.exception';
import { RoleExceptionCode, RoleExceptionMap } from './role.exception';
import { UserExceptionCode, UserExceptionMap } from './user.exception';

/**
 * 错误码
 * 命名规则：MMSNN 模块代码 + 状态码类别 + 序列号
 * @example INVALID_CREDENTIALS (401): Auth(10) + 4xx(4) + 01 => '10401'
 */
export const ErrorExceptionCode = {
  ...AuthExceptionCode,
  ...CatExceptionCode,
  ...GroupExceptionCode,
  ...PermissionExceptionCode,
  ...RoleExceptionCode,
  ...UserExceptionCode,
} as const;

export type ErrorExceptionCode =
  (typeof ErrorExceptionCode)[keyof typeof ErrorExceptionCode];

export const ErrorExceptionMap: Record<ErrorExceptionCode, ExceptionInfo> = {
  ...AuthExceptionMap,
  ...CatExceptionMap,
  ...GroupExceptionMap,
  ...PermissionExceptionMap,
  ...RoleExceptionMap,
  ...UserExceptionMap,
};

export class ErrorException extends BaseException {
  constructor(errorCode: ErrorExceptionCode) {
    const exception = ErrorExceptionMap[errorCode];
    super(exception);
  }
}
