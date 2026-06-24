import { userContextStorage } from '@/common/context/user-context';
import { AppThrottlerGuard } from '@/shared/throttler/throttler.guard';
import { User } from '@/modules/users/entities/user.entity';
import { AuthRequest } from '@/types/express';
import { describe, expect, it } from 'vitest';

class TestThrottlerGuard extends AppThrottlerGuard {
  getTrackerForTest(req: AuthRequest) {
    return this.getTracker(req);
  }
}

const createUser = (id = 'user-id') => {
  const user = new User();
  user.id = id;
  return user;
};

describe('AppThrottlerGuard', () => {
  it('should use async context user id as tracker first', async () => {
    const guard = new TestThrottlerGuard({} as never, {} as never, {} as never);
    const req = {
      ip: '127.0.0.1',
      user: createUser('request-user-id'),
    } as AuthRequest;

    await userContextStorage.run(createUser('context-user-id'), async () => {
      await expect(guard.getTrackerForTest(req)).resolves.toBe(
        'user:context-user-id',
      );
    });
  });

  it('should fallback to request user id', async () => {
    const guard = new TestThrottlerGuard({} as never, {} as never, {} as never);
    const req = {
      ip: '127.0.0.1',
      user: createUser('request-user-id'),
    } as AuthRequest;

    await expect(guard.getTrackerForTest(req)).resolves.toBe(
      'user:request-user-id',
    );
  });

  it('should fallback to request ip', async () => {
    const guard = new TestThrottlerGuard({} as never, {} as never, {} as never);
    const req = {
      ip: '127.0.0.1',
    } as AuthRequest;

    await expect(guard.getTrackerForTest(req)).resolves.toBe('ip:127.0.0.1');
  });
});
