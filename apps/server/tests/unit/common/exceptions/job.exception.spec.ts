import {
  ErrorException,
  ErrorExceptionCode,
} from '@/common/exceptions/error.exception';
import { describe, expect, it } from 'vitest';

describe('Job exceptions', () => {
  it('should expose job not found exception', () => {
    const exception = new ErrorException(ErrorExceptionCode.JOB_NOT_FOUND);

    expect(exception.getStatus()).toBe(404);
    expect(exception.code).toBe(ErrorExceptionCode.JOB_NOT_FOUND);
    expect(exception.getResponse()).toEqual({
      message: '任务不存在',
      statusCode: 404,
      code: ErrorExceptionCode.JOB_NOT_FOUND,
    });
  });

  it('should expose job not cancellable exception', () => {
    const exception = new ErrorException(
      ErrorExceptionCode.JOB_NOT_CANCELLABLE,
    );

    expect(exception.getStatus()).toBe(409);
    expect(exception.code).toBe(ErrorExceptionCode.JOB_NOT_CANCELLABLE);
  });
});
