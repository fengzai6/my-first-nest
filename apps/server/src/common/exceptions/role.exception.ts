import { HttpStatus } from '@nestjs/common';
import { ExceptionInfo } from './base.exception';

export const RoleExceptionCode = {
  ROLE_NOT_FOUND: '15401',
} as const;

export type RoleExceptionCode =
  (typeof RoleExceptionCode)[keyof typeof RoleExceptionCode];

export const RoleExceptionMap: Record<RoleExceptionCode, ExceptionInfo> = {
  [RoleExceptionCode.ROLE_NOT_FOUND]: {
    message: 'Role not found',
    status: HttpStatus.NOT_FOUND,
    code: RoleExceptionCode.ROLE_NOT_FOUND,
  },
};
