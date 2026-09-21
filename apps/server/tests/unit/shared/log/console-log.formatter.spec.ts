import { LOG_CATEGORY, LOG_LEVEL } from '@/shared/log/constants/log.constants';
import { formatConsoleLogEvent } from '@/shared/log/console-log.formatter';
import type { ILogEvent } from '@/shared/log/interfaces/log.interface';
import { describe, expect, it } from 'vitest';

const createEvent = (overrides: Partial<ILogEvent> = {}): ILogEvent => ({
  id: 'log-1',
  level: LOG_LEVEL.ERROR,
  category: LOG_CATEGORY.HTTP,
  message: 'request failed',
  context: { code: '10403' },
  requestId: 'request-1',
  userId: 'user-1',
  ip: '127.0.0.1',
  method: 'POST',
  url: '/api/auth/refresh-token',
  statusCode: 401,
  duration: 12,
  stack:
    'UnauthorizedException: jwt expired\n' +
    `    at JwtStrategy.validate (${process.cwd()}/apps/server/src/auth.strategy.ts:40:13)`,
  timestamp: new Date('2026-09-10T12:34:56.000Z'),
  ...overrides,
});

describe('formatConsoleLogEvent', () => {
  it('renders a readable multi-line event for development terminals', () => {
    const output = formatConsoleLogEvent(createEvent(), {
      pretty: true,
      color: false,
    });

    expect(output).toContain(
      '[2026-09-10 12:34:56.000Z] ERROR [HTTP] request failed',
    );
    expect(output).toContain('  POST /api/auth/refresh-token -> 401 in 12ms');
    expect(output).toContain(
      '  requestId=request-1 logId=log-1 userId=user-1 ip=127.0.0.1',
    );
    expect(output).toContain('  context: {"code":"10403"}');
    expect(output).toContain(
      '  stack:\n' +
        '    UnauthorizedException: jwt expired\n' +
        '        at JwtStrategy.validate (apps/server/src/auth.strategy.ts:40:13)',
    );
  });

  it('adds ANSI colors only when requested', () => {
    const plain = formatConsoleLogEvent(createEvent(), {
      pretty: true,
      color: false,
    });
    const colored = formatConsoleLogEvent(createEvent(), {
      pretty: true,
      color: true,
    });

    expect(plain).not.toContain('\u001b[');
    expect(colored).toContain('\u001b[31mERROR\u001b[0m');
    expect(colored).toContain('\u001b[36m[HTTP]\u001b[0m');
  });

  it('keeps the CLEF JSON contract for non-pretty output', () => {
    const output = formatConsoleLogEvent(createEvent(), {
      pretty: false,
      color: false,
    });

    expect(JSON.parse(output)).toMatchObject({
      '@l': 'Error',
      '@m': 'request failed',
      '@x': createEvent().stack,
      requestId: 'request-1',
    });
  });
});
