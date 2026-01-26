import { HttpStatus } from '@nestjs/common';
import { ExceptionInfo } from './base.exception';

export const PermissionExceptionCode = {
  PERMISSION_NOT_FOUND: '14401',
} as const;

export type PermissionExceptionCode =
  (typeof PermissionExceptionCode)[keyof typeof PermissionExceptionCode];

export const PermissionExceptionMap: Record<
  PermissionExceptionCode,
  ExceptionInfo
> = {
  [PermissionExceptionCode.PERMISSION_NOT_FOUND]: {
    message: 'Permission not found',
    status: HttpStatus.NOT_FOUND,
    code: PermissionExceptionCode.PERMISSION_NOT_FOUND,
  },
};
