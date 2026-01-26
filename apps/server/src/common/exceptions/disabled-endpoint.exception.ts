import { HttpStatus } from '@nestjs/common';
import { BaseException } from './base.exception';

export enum DisabledEndpointExceptionCode {
  ENDPOINT_DISABLED = 'ENDPOINT_DISABLED',
}

export class DisabledEndpointException extends BaseException {
  constructor() {
    super({
      message: '此接口已被禁用或正在开发中，暂时无法使用',
      status: HttpStatus.FORBIDDEN,
      code: DisabledEndpointExceptionCode.ENDPOINT_DISABLED,
    });
  }
}
