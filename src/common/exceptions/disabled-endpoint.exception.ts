import { HttpException, HttpStatus } from '@nestjs/common';

export class DisabledEndpointException extends HttpException {
  constructor() {
    super('此接口已被禁用或正在开发中，暂时无法使用', HttpStatus.FORBIDDEN);
  }
}
