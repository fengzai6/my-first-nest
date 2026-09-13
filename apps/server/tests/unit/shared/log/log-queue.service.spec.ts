import type {
  ILogBatchJobData,
  ILogEvent,
} from '@/shared/log/interfaces/log.interface';
import { LogQueueService } from '@/shared/log/log-queue.service';
import { ConfigService } from '@nestjs/config';
import type { Queue } from 'bullmq';
import { afterEach, describe, expect, it, vi } from 'vitest';

const createConfigService = () =>
  ({
    get: vi.fn((key: string) => {
      if (key === 'default') {
        return {
          log: {
            batchSize: 2,
            flushIntervalMs: 10,
          },
        };
      }

      return {};
    }),
  }) as unknown as ConfigService;

const createEvent = (id: string): ILogEvent => ({
  id,
  level: 'info',
  category: 'TEST',
  message: id,
  context: null,
  requestId: null,
  userId: null,
  ip: null,
  method: null,
  url: null,
  statusCode: null,
  duration: null,
  stack: null,
  timestamp: new Date('2026-09-13T00:00:00.000Z'),
});

const createQueue = (add: Queue<ILogBatchJobData>['add']) =>
  ({
    add,
  }) as unknown as Queue<ILogBatchJobData>;

describe('LogQueueService', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('caps the retry buffer when enqueueing keeps failing', async () => {
    const stderr = vi.spyOn(process.stderr, 'write').mockReturnValue(true);
    const queue = createQueue(
      vi.fn().mockRejectedValue(new Error('redis down')),
    );
    const service = new LogQueueService(queue, createConfigService());

    service.enqueue(createEvent('1'));
    service.enqueue(createEvent('2'));
    await service.flush();

    service.enqueue(createEvent('3'));
    service.enqueue(createEvent('4'));
    await service.flush();

    await expect(service.onModuleDestroy()).resolves.toBeUndefined();
    expect(stderr).toHaveBeenCalledWith(
      expect.stringContaining('Dropped 4 buffered log events during shutdown'),
    );
  });

  it('rejects events after shutdown starts', async () => {
    const add = vi.fn().mockResolvedValue(undefined);
    const queue = createQueue(add);
    const service = new LogQueueService(queue, createConfigService());

    await service.onModuleDestroy();
    service.enqueue(createEvent('1'));
    await service.flush();

    expect(add).not.toHaveBeenCalled();
  });

  it('keeps flushing remaining events during shutdown', async () => {
    let resolveFirstAdd: (() => void) | undefined;
    const add = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            resolveFirstAdd = resolve;
          }),
      )
      .mockResolvedValue(undefined);
    const queue = createQueue(add);
    const service = new LogQueueService(queue, createConfigService());

    service.enqueue(createEvent('1'));
    service.enqueue(createEvent('2'));
    const flushing = service.flush();
    service.enqueue(createEvent('3'));

    resolveFirstAdd?.();
    await flushing;
    await service.onModuleDestroy();

    expect(add).toHaveBeenCalledTimes(2);
    expect(add.mock.calls[1]?.[1]).toMatchObject({
      events: [expect.objectContaining({ id: '3' })],
    });
  });

  it('bounds shutdown work when the queue remains unavailable', async () => {
    const stderr = vi.spyOn(process.stderr, 'write').mockReturnValue(true);
    const add = vi.fn().mockRejectedValue(new Error('redis down'));
    const queue = createQueue(add);
    const service = new LogQueueService(queue, createConfigService());

    service.enqueue(createEvent('1'));
    await service.onModuleDestroy();

    expect(add).toHaveBeenCalledTimes(1);
    expect(stderr).toHaveBeenCalledWith(
      expect.stringContaining('Dropped 1 buffered log events during shutdown'),
    );
  });
});
