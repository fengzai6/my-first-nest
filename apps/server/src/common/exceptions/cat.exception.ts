import { HttpStatus } from '@nestjs/common';
import { ExceptionInfo } from './base.exception';

export const CatExceptionCode = {
  CAT_NOT_FOUND: '13401',
} as const;

export type CatExceptionCode =
  (typeof CatExceptionCode)[keyof typeof CatExceptionCode];

export const CatExceptionMap: Record<CatExceptionCode, ExceptionInfo> = {
  [CatExceptionCode.CAT_NOT_FOUND]: {
    message: 'Cat not found',
    status: HttpStatus.NOT_FOUND,
    code: CatExceptionCode.CAT_NOT_FOUND,
  },
};
