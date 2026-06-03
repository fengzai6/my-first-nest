import { describe, expect, it } from 'vitest';
import {
  ErrorException,
  ErrorExceptionCode,
} from '@/common/exceptions/error.exception';

describe('ErrorException', () => {
  it('should expose configured response and status', () => {
    const exception = new ErrorException(ErrorExceptionCode.UNAUTHORIZED);

    expect(exception.getStatus()).toBe(401);
    expect(exception.code).toBe(ErrorExceptionCode.UNAUTHORIZED);
    expect(exception.getResponse()).toEqual({
      message: '未授权访问',
      statusCode: 401,
      code: ErrorExceptionCode.UNAUTHORIZED,
    });
  });
});
