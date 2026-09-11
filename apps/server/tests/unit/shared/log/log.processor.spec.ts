import { LOG_CATEGORY, LOG_LEVEL } from '@/shared/log/constants/log.constants';
import type {
  ILogBatchJobData,
  ILogEvent,
} from '@/shared/log/interfaces/log.interface';
import { LogProcessor } from '@/shared/log/log.processor';
import { LogService } from '@/shared/log/log.service';
import { SeqTransportService } from '@/shared/log/seq-transport.service';
import type { Job } from 'bullmq';
import { describe, expect, it, vi } from 'vitest';

const event: ILogEvent = {
  id: 'log-1',
  level: LOG_LEVEL.INFO,
  category: LOG_CATEGORY.HTTP,
  message: 'request completed',
  context: null,
  requestId: 'request-1',
  userId: null,
  ip: '127.0.0.1',
  method: 'GET',
  url: '/api/cats',
  statusCode: 200,
  duration: 12,
  stack: null,
  timestamp: new Date('2026-09-10T12:34:56.000Z'),
};

const toQueuedEvent = (
  logEvent: ILogEvent,
): ILogBatchJobData['events'][number] => ({
  ...logEvent,
  timestamp: logEvent.timestamp.toISOString(),
});

const createProcessor = () => {
  const logs = {
    insertIgnoreConflicts: vi.fn().mockResolvedValue(undefined),
  };
  const seqTransport = {
    send: vi.fn().mockResolvedValue(undefined),
  };
  const processor = new LogProcessor(
    logs as unknown as LogService,
    seqTransport as unknown as SeqTransportService,
  );

  return { processor, logs, seqTransport };
};

describe('LogProcessor', () => {
  it('persists a batch before sending it to Seq', async () => {
    const { processor, logs, seqTransport } = createProcessor();
    const queuedEvent = toQueuedEvent(event);

    await processor.process({
      data: { events: [queuedEvent] },
    } as Job<ILogBatchJobData>);

    expect(logs.insertIgnoreConflicts).toHaveBeenCalledWith([event]);
    expect(seqTransport.send).toHaveBeenCalledWith([event]);
    expect(logs.insertIgnoreConflicts.mock.invocationCallOrder[0]).toBeLessThan(
      seqTransport.send.mock.invocationCallOrder[0],
    );
  });

  it('normalizes timestamps serialized by BullMQ before processing', async () => {
    const { processor, logs, seqTransport } = createProcessor();
    const queuedEvent = toQueuedEvent(event);

    await processor.process({
      data: { events: [queuedEvent] },
    } as Job<ILogBatchJobData>);

    expect(logs.insertIgnoreConflicts).toHaveBeenCalledWith([event]);
    expect(seqTransport.send).toHaveBeenCalledWith([event]);
  });

  it('rejects when Seq delivery fails so BullMQ can retry', async () => {
    const { processor, seqTransport } = createProcessor();
    const queuedEvent = toQueuedEvent(event);
    seqTransport.send.mockRejectedValue(new Error('seq unavailable'));

    await expect(
      processor.process({
        data: { events: [queuedEvent] },
      } as Job<ILogBatchJobData>),
    ).rejects.toThrow('seq unavailable');
  });
});
