import type { SeqConfig } from '@/config/configuration.interface';
import type { ILogEvent } from '@/shared/log/interfaces/log.interface';
import { SeqTransportService } from '@/shared/log/seq-transport.service';
import { LOG_CATEGORY, LOG_LEVEL } from '@/shared/log/constants/log.constants';
import { afterEach, describe, expect, it, vi } from 'vitest';

const createEvent = (overrides: Partial<ILogEvent> = {}): ILogEvent => ({
  id: 'log-1',
  level: LOG_LEVEL.INFO,
  category: LOG_CATEGORY.HTTP,
  message: 'request completed',
  context: { route: '/api/cats' },
  requestId: 'request-1',
  userId: 'user-1',
  ip: '127.0.0.1',
  method: 'GET',
  url: '/api/cats',
  statusCode: 200,
  duration: 12,
  stack: null,
  timestamp: new Date('2026-09-10T12:34:56.000Z'),
  ...overrides,
});

const createTransport = (seq: SeqConfig) => {
  const get = vi.fn((key: string) =>
    key === 'default' ? { log: { seq } } : {},
  );

  return new SeqTransportService({ get } as never);
};

describe('SeqTransportService', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('posts newline-delimited CLEF events with API key authentication', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue({
      status: 201,
      text: vi.fn(),
    } as unknown as Response);
    vi.stubGlobal('fetch', fetchMock);
    const transport = createTransport({
      enabled: true,
      url: 'http://seq:5341/',
      apiKey: 'seq-key',
      timeoutMs: 5000,
    });

    await transport.send([createEvent(), createEvent({ id: 'log-2' })]);

    const request = fetchMock.mock.calls[0]?.[1];
    expect(fetchMock.mock.calls[0]?.[0]).toBe('http://seq:5341/ingest/clef');
    expect(request?.method).toBe('POST');
    expect(request?.headers).toEqual({
      'Content-Type': 'application/vnd.serilog.clef',
      'X-Seq-ApiKey': 'seq-key',
    });
    expect(request?.body).toEqual(expect.stringContaining('"@t"'));
    expect(request?.signal).toBeInstanceOf(AbortSignal);
    if (typeof request?.body !== 'string') {
      throw new TypeError('Expected Seq request body to be a string');
    }

    expect(request.body.split('\n')).toHaveLength(2);
  });

  it('does not call Seq when HTTP push is disabled', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const transport = createTransport({
      enabled: false,
      timeoutMs: 5000,
    });

    await transport.send([createEvent()]);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects non-201 responses with a bounded error body', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      status: 503,
      text: vi.fn().mockResolvedValue('x'.repeat(600)),
    });
    vi.stubGlobal('fetch', fetchMock);
    const transport = createTransport({
      enabled: true,
      url: 'http://seq:5341',
      timeoutMs: 5000,
    });

    await expect(transport.send([createEvent()])).rejects.toThrow(
      new RegExp(`^Seq ingestion failed: 503 ${'x'.repeat(500)}$`),
    );
  });
});
