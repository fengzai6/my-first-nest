import { TokenType } from '@/common/constants/auth';
import { AuthSocket } from '@/modules/socket/interface/auth-socket';
import { SocketGateway } from '@/modules/socket/socket.gateway';
import { SocketService } from '@/modules/socket/socket.service';
import { User } from '@/modules/users/entities/user.entity';
import { UsersService } from '@/modules/users/users.service';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  MockInstance,
  vi,
} from 'vitest';

type MockSocketService = {
  getUserSockets: MockInstance<(userId: string) => Set<Socket> | undefined>;
  handleConnection: MockInstance<(client: Socket, user: User) => void>;
  handleDisconnect: MockInstance<(client: Socket, user: User) => void>;
};

type MockJwtService = {
  verify: MockInstance<
    (
      token: string,
      options: {
        secret: string;
      },
    ) => {
      sub: string;
      type: TokenType;
    }
  >;
};

type MockUsersService = {
  findOne: MockInstance<(criteria: { id: string }) => Promise<User>>;
};

const createUser = ({
  id = 'user-id',
  username = 'fengzai',
  nickname,
}: Partial<User> = {}) => {
  const user = new User();
  user.id = id;
  user.username = username;
  user.nickname = nickname as string;
  return user;
};

const createConfigService = () =>
  ({
    get: vi.fn((key: string) => {
      if (key === 'default') {
        return { jwt: { secret: 'secret' } };
      }
      if (key === 'development') {
        return { jwt: {} };
      }
      return undefined;
    }),
  }) as unknown as ConfigService;

const createSocket = ({
  token = 'access-token',
  user,
}: {
  token?: string;
  user?: User;
} = {}) => {
  const broadcastEmit = vi.fn();
  const disconnect = vi.fn();
  const emit = vi.fn();
  const join = vi.fn(() => Promise.resolve());
  const leave = vi.fn(() => Promise.resolve());
  const roomEmit = vi.fn();
  const roomSocket = {
    emit: roomEmit,
  };
  const to = vi.fn(() => roomSocket);
  const client = {
    id: 'socket-id',
    broadcast: {
      emit: broadcastEmit,
    },
    disconnect,
    emit,
    handshake: {
      auth: {
        token,
      },
      headers: {},
    },
    join,
    leave,
    to,
    user,
  } as unknown as AuthSocket & {
    to: MockInstance<(room: string) => { emit: MockInstance }>;
  };

  return {
    broadcastEmit,
    client,
    disconnect,
    emit,
    join,
    leave,
    roomEmit,
    roomSocket,
  };
};

const createGateway = () => {
  const socketService: MockSocketService = {
    getUserSockets: vi.fn(),
    handleConnection: vi.fn(),
    handleDisconnect: vi.fn(),
  };
  const jwtService: MockJwtService = {
    verify: vi.fn(() => ({ sub: 'user-id', type: TokenType.ACCESS })),
  };
  const usersService: MockUsersService = {
    findOne: vi.fn(() => Promise.resolve(createUser({ nickname: 'Feng' }))),
  };
  const gateway = new SocketGateway(
    socketService as unknown as SocketService,
    jwtService as unknown as JwtService,
    createConfigService(),
    usersService as unknown as UsersService,
  );
  const serverEmit = vi.fn();
  const server = {
    emit: serverEmit,
  } as unknown as Server;

  gateway.server = server;

  return {
    gateway,
    jwtService,
    server,
    serverEmit,
    socketService,
    usersService,
  };
};

describe('SocketGateway', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should authenticate socket connection and notify clients', async () => {
    const { gateway, socketService } = createGateway();
    const { broadcastEmit, client, emit } = createSocket();

    await gateway.handleConnection(client);

    expect(socketService.handleConnection).toHaveBeenCalledWith(
      client,
      client.user,
    );
    expect(emit).toHaveBeenCalledWith('connected', {
      message: 'Welcome, Feng!',
      userId: 'user-id',
      username: 'fengzai',
    });
    expect(broadcastEmit).toHaveBeenCalledWith('user-joined', {
      displayName: 'Feng',
      userId: 'user-id',
      username: 'fengzai',
    });
  });

  it('should reject connection without token', async () => {
    const { gateway, socketService } = createGateway();
    const { client, disconnect, emit } = createSocket({ token: '' });

    await gateway.handleConnection(client);

    expect(socketService.handleConnection).not.toHaveBeenCalled();
    expect(emit).toHaveBeenCalledWith('exception', {
      status: 401,
      message: 'Invalid token',
    });
    expect(disconnect).toHaveBeenCalledTimes(1);
  });

  it('should reject refresh token on connection', async () => {
    const { gateway, jwtService } = createGateway();
    const { client, disconnect } = createSocket();

    jwtService.verify.mockReturnValue({
      sub: 'user-id',
      type: TokenType.REFRESH,
    });

    await gateway.handleConnection(client);

    expect(disconnect).toHaveBeenCalledTimes(1);
  });

  it('should notify server when authenticated user disconnects', () => {
    const { gateway, serverEmit, socketService } = createGateway();
    const user = createUser();
    const { client } = createSocket({ user });

    gateway.handleDisconnect(client);

    expect(socketService.handleDisconnect).toHaveBeenCalledWith(client, user);
    expect(serverEmit).toHaveBeenCalledWith('user-left', {
      userId: 'user-id',
      username: 'fengzai',
    });
  });

  it('should join room for authenticated user', async () => {
    const { gateway } = createGateway();
    const user = createUser();
    const { client, emit, join, roomEmit } = createSocket({ user });

    const result = await gateway.handleJoinRoom(client, { room: 'room-a' });

    expect(join).toHaveBeenCalledWith('room-a');
    expect(emit).toHaveBeenCalledWith('room-joined', {
      room: 'room-a',
    });
    expect(roomEmit).toHaveBeenCalledWith('room-user-joined', {
      room: 'room-a',
      userId: 'user-id',
      username: 'fengzai',
    });
    expect(result).toEqual({ success: true });
  });

  it('should reject room action without authenticated user', async () => {
    const { gateway } = createGateway();
    const { client } = createSocket();

    await expect(
      gateway.handleJoinRoom(client, { room: 'room-a' }),
    ).resolves.toEqual({
      success: false,
      message: 'Not authenticated',
    });
  });

  it('should send direct message to all target user sockets', () => {
    const { gateway, socketService } = createGateway();
    const user = createUser();
    const targetSocketAEmit = vi.fn();
    const targetSocketBEmit = vi.fn();
    const targetSocketA = { emit: targetSocketAEmit } as unknown as Socket;
    const targetSocketB = { emit: targetSocketBEmit } as unknown as Socket;
    const { client } = createSocket({ user });

    socketService.getUserSockets.mockReturnValue(
      new Set([targetSocketA, targetSocketB]),
    );

    const result = gateway.handleSendToUser(client, {
      targetUserId: 'target-user-id',
      message: 'hello',
    });

    expect(targetSocketAEmit).toHaveBeenCalledWith('direct-message', {
      message: 'hello',
      senderDisplayName: 'fengzai',
      senderId: 'user-id',
      senderUsername: 'fengzai',
      timestamp: '2026-01-01T00:00:00.000Z',
    });
    expect(targetSocketBEmit).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ success: true });
  });

  it('should report when target user is offline', () => {
    const { gateway, socketService } = createGateway();
    const { client } = createSocket({ user: createUser() });

    socketService.getUserSockets.mockReturnValue(undefined);

    expect(
      gateway.handleSendToUser(client, {
        targetUserId: 'target-user-id',
        message: 'hello',
      }),
    ).toEqual({
      success: false,
      message: 'Target user is not connected',
    });
  });

  it('should broadcast message from authenticated user', () => {
    const { gateway } = createGateway();
    const { broadcastEmit, client } = createSocket({ user: createUser() });

    const result = gateway.handleBroadcast(client, { message: 'hello all' });

    expect(broadcastEmit).toHaveBeenCalledWith('broadcast-message', {
      message: 'hello all',
      senderDisplayName: 'fengzai',
      senderId: 'user-id',
      senderUsername: 'fengzai',
      timestamp: '2026-01-01T00:00:00.000Z',
    });
    expect(result).toEqual({ success: true });
  });

  it('should reject connection when JWT verification throws', async () => {
    const { gateway, jwtService } = createGateway();
    const { client, disconnect, emit } = createSocket();

    jwtService.verify.mockImplementation(() => {
      throw new Error('jwt malformed');
    });

    await gateway.handleConnection(client);

    expect(emit).toHaveBeenCalledWith('exception', {
      status: 401,
      message: 'Invalid token',
    });
    expect(disconnect).toHaveBeenCalledTimes(1);
  });

  it('should reject connection when JWT throws non-Error', async () => {
    const { gateway, jwtService } = createGateway();
    const { client, disconnect } = createSocket();

    jwtService.verify.mockImplementation(() => {
      throw new Error('string error');
    });

    await gateway.handleConnection(client);

    expect(disconnect).toHaveBeenCalledTimes(1);
  });

  it('should reject connection when user not found', async () => {
    const { gateway, usersService } = createGateway();
    const { client, disconnect, emit } = createSocket();

    usersService.findOne.mockResolvedValue(null as never);

    await gateway.handleConnection(client);

    expect(emit).toHaveBeenCalledWith('exception', {
      status: 401,
      message: 'Invalid token',
    });
    expect(disconnect).toHaveBeenCalledTimes(1);
  });

  it('should leave room for authenticated user', async () => {
    const { gateway } = createGateway();
    const user = createUser();
    const { client, emit, leave, roomEmit } = createSocket({ user });

    const result = await gateway.handleLeaveRoom(client, { room: 'room-a' });

    expect(leave).toHaveBeenCalledWith('room-a');
    expect(emit).toHaveBeenCalledWith('room-left', { room: 'room-a' });
    expect(roomEmit).toHaveBeenCalledWith('room-user-left', {
      room: 'room-a',
      userId: 'user-id',
      username: 'fengzai',
    });
    expect(result).toEqual({ success: true });
  });

  it('should reject leave room without authenticated user', async () => {
    const { gateway } = createGateway();
    const { client } = createSocket();

    await expect(
      gateway.handleLeaveRoom(client, { room: 'room-a' }),
    ).resolves.toEqual({
      success: false,
      message: 'Not authenticated',
    });
  });

  it('should send message to room for authenticated user', () => {
    const { gateway } = createGateway();
    const user = createUser();
    const { client, roomEmit } = createSocket({ user });

    const result = gateway.handleSendToRoom(client, {
      room: 'room-a',
      message: 'hello room',
    });

    expect(roomEmit).toHaveBeenCalledWith('room-message', {
      room: 'room-a',
      message: 'hello room',
      senderId: 'user-id',
      senderUsername: 'fengzai',
      senderDisplayName: 'fengzai',
      timestamp: '2026-01-01T00:00:00.000Z',
    });
    expect(result).toEqual({ success: true });
  });

  it('should reject send to room without authenticated user', () => {
    const { gateway } = createGateway();
    const { client } = createSocket();

    expect(
      gateway.handleSendToRoom(client, { room: 'room-a', message: 'hi' }),
    ).toEqual({
      success: false,
      message: 'Not authenticated',
    });
  });

  it('should reject direct message without authenticated user', () => {
    const { gateway } = createGateway();
    const { client } = createSocket();

    expect(
      gateway.handleSendToUser(client, {
        targetUserId: 'target',
        message: 'hi',
      }),
    ).toEqual({
      success: false,
      message: 'Not authenticated',
    });
  });

  it('should reject broadcast without authenticated user', () => {
    const { gateway } = createGateway();
    const { client } = createSocket();

    expect(gateway.handleBroadcast(client, { message: 'hi' })).toEqual({
      success: false,
      message: 'Not authenticated',
    });
  });
});
