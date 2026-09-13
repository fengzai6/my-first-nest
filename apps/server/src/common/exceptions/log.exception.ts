import { HttpStatus } from '@nestjs/common';
import { ExceptionInfo } from './base.exception';

export const LogExceptionCode = {
  LOG_NOT_FOUND: '16401',
} as const;

export type LogExceptionCode =
  (typeof LogExceptionCode)[keyof typeof LogExceptionCode];

export const LogExceptionMap: Record<LogExceptionCode, ExceptionInfo> = {
  [LogExceptionCode.LOG_NOT_FOUND]: {
    message: '日志不存在',
    status: HttpStatus.NOT_FOUND,
    code: LogExceptionCode.LOG_NOT_FOUND,
  },
};
