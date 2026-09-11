import {
  requestContextStorage,
  type IRequestContext,
} from '@/common/context/request-context';
import { LOG_CATEGORY, LOG_LEVEL } from '@/shared/log/constants/log.constants';
import { LoggerService } from '@/shared/log/logger.service';
import { initSnowflake, resetSnowflake } from '@/shared/utils/snowflake';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const createLogger = () => {
  const queue = {
    enqueue: vi.fn(),
  };
  const logger = new LoggerService(queue as never);

  return { logger, queue };
};

describe('LoggerService', () => {
  beforeEach(() => {
    initSnowflake(0n, 0n);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    resetSnowflake();
  });

  it('writes CLEF JSON and queues an enriched event without awaiting I/O', () => {
    const { logger, queue } = createLogger();
    const write = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
    const context: IRequestContext = {
      requestId: 'request-1',
      startedAt: 0,
      method: 'GET',
      url: '/api/cats',
      ip: '127.0.0.1',
      userId: 'user-1',
    };

    requestContextStorage.run(context, () =>
      logger.log('request completed', { category: LOG_CATEGORY.HTTP }),
    );

    expect(queue.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        level: LOG_LEVEL.INFO,
        requestId: 'request-1',
        userId: 'user-1',
        method: 'GET',
        url: '/api/cats',
      }),
    );
    const output = String(write.mock.calls[0]?.[0]);
    expect(output).toContain('"@m":"request completed"');
    expect(output).toContain('"requestId":"request-1"');
    expect(JSON.parse(output)).toMatchObject({
      '@l': 'Info',
      '@m': 'request completed',
      requestId: 'request-1',
      userId: 'user-1',
    });
  });

  it('does not let queue failures escape to the caller', () => {
    const { logger, queue } = createLogger();
    vi.spyOn(process.stdout, 'write').mockReturnValue(true);
    const stderr = vi.spyOn(process.stderr, 'write').mockReturnValue(true);
    queue.enqueue.mockImplementation(() => {
      throw new Error('redis down');
    });

    expect(() => logger.log('request completed')).not.toThrow();
    expect(String(stderr.mock.calls[0]?.[0])).toContain(
      'Failed to enqueue log',
    );
  });

  it('serializes non-Error values into the stack field', () => {
    const { logger, queue } = createLogger();
    vi.spyOn(process.stdout, 'write').mockReturnValue(true);

    logger.error('request failed', { reason: 'invalid token' });

    expect(queue.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        level: LOG_LEVEL.ERROR,
        stack: '{"reason":"invalid token"}',
      }),
    );
  });
});
