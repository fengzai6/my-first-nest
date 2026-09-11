import { LOG_CATEGORY } from '@/shared/log/constants/log.constants';
import type { ILogWriteOptions } from '@/shared/log/interfaces/log.interface';
import { LoggingInterceptor } from '@/common/interceptors/logging.interceptor';
import { CallHandler, ExecutionContext } from '@nestjs/common';
import { firstValueFrom, of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

describe('LoggingInterceptor', () => {
  it('logs successful HTTP request summaries', async () => {
    const logger = {
      log: vi.fn<(message: string, options: ILogWriteOptions) => void>(),
    };
    const interceptor = new LoggingInterceptor(logger as never);
    const request = {
      method: 'GET',
      originalUrl: '/api/cats',
      url: '/api/cats',
      ip: '127.0.0.1',
    };
    const response = {
      statusCode: 200,
    };
    const context = {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => response,
      }),
    } as unknown as ExecutionContext;
    const next = {
      handle: () => of({ ok: true }),
    } as CallHandler;

    await firstValueFrom(interceptor.intercept(context, next));

    expect(logger.log).toHaveBeenCalledWith(
      'HTTP request completed',
      expect.objectContaining({
        category: LOG_CATEGORY.HTTP,
        method: 'GET',
        url: '/api/cats',
        ip: '127.0.0.1',
        statusCode: 200,
      }),
    );
    expect(logger.log.mock.calls[0]?.[1]?.duration).toEqual(expect.any(Number));
  });
});
