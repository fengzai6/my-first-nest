import { HttpStatus } from '@nestjs/common';
import { BaseException, ExceptionInfo } from './base.exception';

export const AttachmentExceptionCode = {
  FILE_REQUIRED: 'ATTACHMENT_FILE_REQUIRED',
  FILE_TOO_LARGE: 'ATTACHMENT_FILE_TOO_LARGE',
  MIME_TYPE_NOT_ALLOWED: 'ATTACHMENT_MIME_TYPE_NOT_ALLOWED',
  NOT_FOUND: 'ATTACHMENT_NOT_FOUND',
  FORBIDDEN: 'ATTACHMENT_FORBIDDEN',
  INVALID_SIGNATURE: 'ATTACHMENT_INVALID_SIGNATURE',
  IN_USE: 'ATTACHMENT_IN_USE',
  CLEANUP_ALREADY_RUNNING: 'ATTACHMENT_CLEANUP_ALREADY_RUNNING',
} as const;

export type AttachmentExceptionCode =
  (typeof AttachmentExceptionCode)[keyof typeof AttachmentExceptionCode];

export const AttachmentExceptionMap: Record<
  AttachmentExceptionCode,
  ExceptionInfo
> = {
  [AttachmentExceptionCode.FILE_REQUIRED]: {
    message: '请选择要上传的文件',
    status: HttpStatus.BAD_REQUEST,
    code: AttachmentExceptionCode.FILE_REQUIRED,
  },
  [AttachmentExceptionCode.FILE_TOO_LARGE]: {
    message: '文件大小超过限制',
    status: HttpStatus.PAYLOAD_TOO_LARGE,
    code: AttachmentExceptionCode.FILE_TOO_LARGE,
  },
  [AttachmentExceptionCode.MIME_TYPE_NOT_ALLOWED]: {
    message: '不支持的文件类型',
    status: HttpStatus.BAD_REQUEST,
    code: AttachmentExceptionCode.MIME_TYPE_NOT_ALLOWED,
  },
  [AttachmentExceptionCode.NOT_FOUND]: {
    message: '附件不存在',
    status: HttpStatus.NOT_FOUND,
    code: AttachmentExceptionCode.NOT_FOUND,
  },
  [AttachmentExceptionCode.FORBIDDEN]: {
    message: '没有权限操作该附件',
    status: HttpStatus.FORBIDDEN,
    code: AttachmentExceptionCode.FORBIDDEN,
  },
  [AttachmentExceptionCode.INVALID_SIGNATURE]: {
    message: '附件访问签名无效或已过期',
    status: HttpStatus.FORBIDDEN,
    code: AttachmentExceptionCode.INVALID_SIGNATURE,
  },
  [AttachmentExceptionCode.IN_USE]: {
    message: '已绑定的附件不能通过通用接口修改或删除',
    status: HttpStatus.CONFLICT,
    code: AttachmentExceptionCode.IN_USE,
  },
  [AttachmentExceptionCode.CLEANUP_ALREADY_RUNNING]: {
    message: '附件清理任务正在执行，请稍后再试',
    status: HttpStatus.CONFLICT,
    code: AttachmentExceptionCode.CLEANUP_ALREADY_RUNNING,
  },
};

export class AttachmentException extends BaseException {
  constructor(code: AttachmentExceptionCode) {
    super(AttachmentExceptionMap[code]);
  }
}
