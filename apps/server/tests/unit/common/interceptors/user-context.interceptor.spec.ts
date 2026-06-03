import {
  useRequestUser,
  userContextStorage,
} from '@/common/context/user-context';
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

    await expect(
      firstValueFrom(interceptor.intercept(context, next)),
    ).resolves.toBe('user-id');
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

    await firstValueFrom(interceptor.intercept(context, next));

    expect(userContextStorage.getStore()).toBeUndefined();
  });
});
