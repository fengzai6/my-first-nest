import { WsExceptionFilter } from '@/common/filters/ws-exception.filter';
import { ArgumentsHost } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const createHost = () => {
  const emit = vi.fn();
  const host = {
    switchToWs: () => ({
      getClient: () => ({ emit }),
    }),
  } as unknown as ArgumentsHost;

  return { emit, host };
};

describe('WsExceptionFilter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should emit normalized string websocket exception', () => {
    const filter = new WsExceptionFilter();
    const { emit, host } = createHost();

    filter.catch(new WsException('invalid'), host);

    expect(emit).toHaveBeenCalledWith('exception', {
      status: 'error',
      message: 'invalid',
    });
  });

  it('should emit object websocket exception unchanged', () => {
    const filter = new WsExceptionFilter();
    const { emit, host } = createHost();
    const error = { status: 401, message: 'Invalid token' };

    filter.catch(new WsException(error), host);

    expect(emit).toHaveBeenCalledWith('exception', error);
  });
});
