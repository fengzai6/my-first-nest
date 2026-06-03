import { TimeoutInterceptor } from '@/common/interceptors/timeout.interceptor';
import {
  CallHandler,
  ExecutionContext,
  GatewayTimeoutException,
  INestApplication,
} from '@nestjs/common';
import { firstValueFrom, NEVER, throwError } from 'rxjs';
import { describe, expect, it } from 'vitest';

const createApp = () =>
  ({
    get: () => ({
      get: (key: string) => {
        if (key === 'default') {
          return {
            server: {
              timeout: 0.001,
            },
          };
        }
        if (key === 'development') {
          return {
            server: {},
          };
        }
        return undefined;
      },
    }),
  }) as unknown as INestApplication;

const createContext = () => ({}) as ExecutionContext;

describe('TimeoutInterceptor', () => {
  it('should convert request processing timeout to gateway timeout', async () => {
    const interceptor = new TimeoutInterceptor(createApp());
    const next = {
      handle: () => NEVER,
    } as CallHandler;

    await expect(
      firstValueFrom(interceptor.intercept(createContext(), next)),
    ).rejects.toBeInstanceOf(GatewayTimeoutException);
  });

  it('should rethrow non-timeout errors unchanged', async () => {
    const interceptor = new TimeoutInterceptor(createApp());
    const error = new Error('boom');
    const next = {
      handle: () => throwError(() => error),
    } as CallHandler;

    await expect(
      firstValueFrom(interceptor.intercept(createContext(), next)),
    ).rejects.toBe(error);
  });
});
