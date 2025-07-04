import { HttpStatus } from '@nestjs/common';

export interface IBaseResponse<T = unknown> {
  message: string;
  status: HttpStatus;
  data?: T;
}

export class BaseResponse<T = unknown> implements IBaseResponse {
  constructor(
    public message: string = 'success',
    public status: HttpStatus = HttpStatus.OK,
    public data?: T,
  ) {}
}
