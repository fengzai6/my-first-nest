import {
  requestContextStorage,
  type IRequestContext,
} from '@/common/context/request-context';
import { LOG_CATEGORY, LOG_LEVEL } from '@/shared/log/constants/log.constants';
import { describe, expect, it } from 'vitest';

describe('logging contracts', () => {
  it('defines the supported levels and base categories', () => {
    expect(Object.values(LOG_LEVEL)).toEqual([
      'debug',
      'info',
      'warn',
      'error',
      'fatal',
    ]);
    expect(LOG_CATEGORY.HTTP).toBe('HTTP');
    expect(LOG_CATEGORY.SOCKET).toBe('Socket');
  });

  it('keeps request metadata in the current async context', async () => {
    const context: IRequestContext = {
      requestId: 'request-1',
      startedAt: 123,
      method: 'GET',
      url: '/api/logs',
      ip: '127.0.0.1',
      userId: 'user-1',
    };

    await requestContextStorage.run(context, async () => {
      await Promise.resolve();
      expect(requestContextStorage.getStore()).toEqual(context);
    });
  });
});
