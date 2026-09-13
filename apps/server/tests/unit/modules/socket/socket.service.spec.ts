import { LOG_CATEGORY } from '@/shared/log/constants/log.constants';
import type { ILogWriteOptions } from '@/shared/log/interfaces/log.interface';
import { User } from '@/modules/users/entities/user.entity';
import { SocketService } from '@/modules/socket/socket.service';
import { Socket } from 'socket.io';
import { beforeEach, describe, expect, it, MockInstance, vi } from 'vitest';

const createUser = (id = 'user-id') => {
  const user = new User();
  user.id = id;
  user.username = 'fengzai';
  return user;
};

const createSocket = (id: string) => ({ id }) as Socket;

describe('SocketService', () => {
  let service: SocketService;
  let logger: {
    log: MockInstance<(message: string, options: ILogWriteOptions) => void>;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    logger = {
      log: vi.fn<(message: string, options: ILogWriteOptions) => void>(),
    };
    service = new SocketService(logger as never);
  });

  it('should track multiple sockets for one user', () => {
    const user = createUser();
    const socketA = createSocket('socket-a');
    const socketB = createSocket('socket-b');

    service.handleConnection(socketA, user);
    service.handleConnection(socketB, user);

    expect(service.isConnected('user-id')).toBe(true);
    expect(service.getConnectedUserIds()).toEqual(['user-id']);
    expect(service.getUserSockets('user-id')).toEqual(
      new Set([socketA, socketB]),
    );
    expect(logger.log).toHaveBeenCalledWith(
      'Socket client connected',
      expect.objectContaining({
        category: LOG_CATEGORY.SOCKET,
        context: {
          socketId: 'socket-b',
          userId: 'user-id',
          username: 'fengzai',
        },
      }),
    );
  });

  it('should remove user only after all sockets disconnect', () => {
    const user = createUser();
    const socketA = createSocket('socket-a');
    const socketB = createSocket('socket-b');

    service.handleConnection(socketA, user);
    service.handleConnection(socketB, user);

    service.handleDisconnect(socketA, user);

    expect(service.isConnected('user-id')).toBe(true);
    expect(service.getUserSockets('user-id')).toEqual(new Set([socketB]));

    service.handleDisconnect(socketB, user);

    expect(service.isConnected('user-id')).toBe(false);
    expect(service.getUserSockets('user-id')).toBeUndefined();
    expect(logger.log).toHaveBeenLastCalledWith(
      'Socket client disconnected',
      expect.objectContaining({
        category: LOG_CATEGORY.SOCKET,
        context: {
          socketId: 'socket-b',
          userId: 'user-id',
          username: 'fengzai',
        },
      }),
    );
  });

  it('should ignore disconnect for unknown user', () => {
    const user = createUser();

    service.handleDisconnect(createSocket('socket-a'), user);

    expect(service.getConnectedUserIds()).toEqual([]);
  });
});
