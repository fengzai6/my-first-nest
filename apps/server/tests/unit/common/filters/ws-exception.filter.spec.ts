import { WsExceptionFilter } from '@/common/filters/ws-exception.filter';
import { LOG_CATEGORY } from '@/shared/log/constants/log.constants';
import { ArgumentsHost } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const createHost = () => {
  const emit = vi.fn();
  const host = {
    switchToWs: () => ({
      getClient: () => ({ id: 'socket-1', emit }),
    }),
  } as unknown as ArgumentsHost;

  return { emit, host };
};

describe('WsExceptionFilter', () => {
  const createFilter = () => {
    const logger = {
      warn: vi.fn(),
    };

    return {
      filter: new WsExceptionFilter(logger as never),
      logger,
    };
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should emit normalized string websocket exception', () => {
    const { filter, logger } = createFilter();
    const { emit, host } = createHost();
    const response = {
      status: 'error',
      message: 'invalid',
    };

    filter.catch(new WsException('invalid'), host);

    expect(emit).toHaveBeenCalledWith('exception', response);
    expect(logger.warn).toHaveBeenCalledWith(
      'WebSocket exception',
      expect.objectContaining({
        category: LOG_CATEGORY.SOCKET,
        context: {
          socketId: 'socket-1',
          error: response,
        },
      }),
    );
  });

  it('should emit object websocket exception unchanged', () => {
    const { filter, logger } = createFilter();
    const { emit, host } = createHost();
    const error = { status: 401, message: 'Invalid token' };

    filter.catch(new WsException(error), host);

    expect(emit).toHaveBeenCalledWith('exception', error);
    expect(logger.warn).toHaveBeenCalledWith(
      'WebSocket exception',
      expect.objectContaining({
        category: LOG_CATEGORY.SOCKET,
        context: {
          socketId: 'socket-1',
          error,
        },
      }),
    );
  });
});
