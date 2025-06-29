import { HttpStatus } from '@nestjs/common';
import { BaseException, ExceptionInfo } from './base.exception';

export enum BusinessExceptionCode {
  RESOURCE_NOT_FOUND = 'RESOURCE_NOT_FOUND',
  RESOURCE_ALREADY_EXISTS = 'RESOURCE_ALREADY_EXISTS',
  OPERATION_FAILED = 'OPERATION_FAILED',
  INVALID_OPERATION = 'INVALID_OPERATION',
  DATA_VALIDATION_FAILED = 'DATA_VALIDATION_FAILED',
}

export const BusinessExceptionMap: Record<
  BusinessExceptionCode,
  ExceptionInfo
> = {
  [BusinessExceptionCode.RESOURCE_NOT_FOUND]: {
    message: '请求的资源不存在',
    status: HttpStatus.NOT_FOUND,
    code: BusinessExceptionCode.RESOURCE_NOT_FOUND,
  },
  [BusinessExceptionCode.RESOURCE_ALREADY_EXISTS]: {
    message: '资源已存在',
    status: HttpStatus.CONFLICT,
    code: BusinessExceptionCode.RESOURCE_ALREADY_EXISTS,
  },
  [BusinessExceptionCode.OPERATION_FAILED]: {
    message: '操作失败',
    status: HttpStatus.BAD_REQUEST,
    code: BusinessExceptionCode.OPERATION_FAILED,
  },
  [BusinessExceptionCode.INVALID_OPERATION]: {
    message: '无效的操作',
    status: HttpStatus.BAD_REQUEST,
    code: BusinessExceptionCode.INVALID_OPERATION,
  },
  [BusinessExceptionCode.DATA_VALIDATION_FAILED]: {
    message: '数据验证失败',
    status: HttpStatus.BAD_REQUEST,
    code: BusinessExceptionCode.DATA_VALIDATION_FAILED,
  },
};

export class BusinessException extends BaseException {
  constructor(errorCode: BusinessExceptionCode, customMessage?: string) {
    const exception = { ...BusinessExceptionMap[errorCode] };

    if (customMessage) {
      exception.message = customMessage;
    }

    super(exception);
  }
}
