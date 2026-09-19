import { HttpStatus } from '@nestjs/common';
import { BaseException, ExceptionInfo } from './base.exception';

export const DocumentExceptionCode = {
  NOT_FOUND: 'DOCUMENT_NOT_FOUND',
  FORBIDDEN: 'DOCUMENT_FORBIDDEN',
} as const;

export type DocumentExceptionCode =
  (typeof DocumentExceptionCode)[keyof typeof DocumentExceptionCode];

export const DocumentExceptionMap: Record<
  DocumentExceptionCode,
  ExceptionInfo
> = {
  [DocumentExceptionCode.NOT_FOUND]: {
    message: '资料文档不存在',
    status: HttpStatus.NOT_FOUND,
    code: DocumentExceptionCode.NOT_FOUND,
  },
  [DocumentExceptionCode.FORBIDDEN]: {
    message: '没有权限操作该资料文档',
    status: HttpStatus.FORBIDDEN,
    code: DocumentExceptionCode.FORBIDDEN,
  },
};

export class DocumentException extends BaseException {
  constructor(code: DocumentExceptionCode) {
    super(DocumentExceptionMap[code]);
  }
}
