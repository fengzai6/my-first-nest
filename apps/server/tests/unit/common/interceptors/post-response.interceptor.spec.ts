import { PostResponseInterceptor } from '@/common/interceptors/post-response.interceptor';
import { CallHandler, ExecutionContext } from '@nestjs/common';
import { firstValueFrom, of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

const createContext = (method: string, statusCode = 201) => {
  const status = vi.fn();
  const response = { status, statusCode };

  return {
    context: {
      switchToHttp: () => ({
        getRequest: () => ({ method }),
        getResponse: () => response,
      }),
    } as unknown as ExecutionContext,
    response,
    status,
  };
};

const createNext = (data: unknown): CallHandler =>
  ({
    handle: () => of(data),
  }) as CallHandler;

describe('PostResponseInterceptor', () => {
  it('should convert POST 201 response status to 200', async () => {
    const interceptor = new PostResponseInterceptor();
    const { context, status } = createContext('POST', 201);

    await expect(
      firstValueFrom(interceptor.intercept(context, createNext({ ok: true }))),
    ).resolves.toEqual({ ok: true });
    expect(status).toHaveBeenCalledWith(200);
  });

  it('should not change non-POST response status', async () => {
    const interceptor = new PostResponseInterceptor();
    const { context, status } = createContext('GET', 200);

    await firstValueFrom(
      interceptor.intercept(context, createNext({ ok: true })),
    );

    expect(status).not.toHaveBeenCalled();
  });
});
