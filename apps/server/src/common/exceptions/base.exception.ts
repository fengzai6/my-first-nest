import { HttpException, HttpStatus } from '@nestjs/common';

export interface ExceptionInfo {
  message: string;
  status: HttpStatus;
  code?: string;
}

export class BaseException extends HttpException {
  public readonly code?: string;

  constructor(info: ExceptionInfo) {
    super(
      {
        message: info.message,
        statusCode: info.status,
        code: info.code,
      },
      info.status,
    );
    this.code = info.code;
  }
}
