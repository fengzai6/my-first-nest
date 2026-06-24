import { HttpStatus } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { BaseResponse } from '@/common/response/base.response';

describe('BaseResponse', () => {
  it('should use success defaults', () => {
    const response = new BaseResponse();

    expect(response).toEqual({
      message: 'success',
      status: HttpStatus.OK,
      data: undefined,
    });
  });

  it('should keep custom message status and data', () => {
    const data = { id: 'user-id' };
    const response = new BaseResponse('created', HttpStatus.CREATED, data);

    expect(response.message).toBe('created');
    expect(response.status).toBe(HttpStatus.CREATED);
    expect(response.data).toBe(data);
  });
});
