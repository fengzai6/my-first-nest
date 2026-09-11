import {
  useRequestUser,
  userContextStorage,
} from '@/common/context/user-context';
import {
  requestContextStorage,
  type IRequestContext,
} from '@/common/context/request-context';
import { UserContextInterceptor } from '@/common/interceptors/user-context.interceptor';
import { User } from '@/modules/users/entities/user.entity';
import { CallHandler, ExecutionContext } from '@nestjs/common';
import { firstValueFrom, of } from 'rxjs';
import { describe, expect, it } from 'vitest';

const createUser = () => {
  const user = new User();
  user.id = 'user-id';
  return user;
};

describe('UserContextInterceptor', () => {
  it('should expose request user inside next handler async context', async () => {
    const interceptor = new UserContextInterceptor();
    const user = createUser();
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    } as unknown as ExecutionContext;
    const next = {
      handle: () => of(useRequestUser().id),
    } as CallHandler;
    const requestContext: IRequestContext = {
      requestId: 'request-id',
      startedAt: 0,
      method: 'GET',
      url: '/api/cats',
      ip: '127.0.0.1',
    };

    await requestContextStorage.run(requestContext, async () => {
      await expect(
        firstValueFrom(interceptor.intercept(context, next)),
      ).resolves.toBe('user-id');
      expect(requestContextStorage.getStore()?.userId).toBe('user-id');
    });
  });

  it('should not leak user context after observable completes', async () => {
    const interceptor = new UserContextInterceptor();
    const user = createUser();
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    } as unknown as ExecutionContext;
    const next = {
      handle: () => of(useRequestUser().id),
    } as CallHandler;
    const requestContext: IRequestContext = {
      requestId: 'request-id',
      startedAt: 0,
      method: 'GET',
      url: '/api/cats',
      ip: '127.0.0.1',
    };

    await requestContextStorage.run(requestContext, async () => {
      await firstValueFrom(interceptor.intercept(context, next));
    });

    expect(userContextStorage.getStore()).toBeUndefined();
  });
});
