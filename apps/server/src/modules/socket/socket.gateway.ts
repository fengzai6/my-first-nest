import { extractWsToken } from '@/shared/utils/extract-token';
import { TokenType } from '@/common/constants/auth';
import { WsExceptionFilter } from '@/common/filters/ws-exception.filter';
import { WsJwtGuard } from '@/common/guards/ws-jwt.guard';
import { getConfig } from '@/config/configuration';
import {
  Logger,
  UseFilters,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server } from 'socket.io';
import { JwtPayload } from '../auth/strategies/jwt-auth.strategy';
import { UsersService } from '../users/users.service';
import {
  BroadcastDto,
  JoinRoomDto,
  LeaveRoomDto,
  SendToRoomDto,
  SendToUserDto,
} from './dto';
import { AuthSocket } from './interface/auth-socket';
import {
  AckResponse,
  ClientToServerEvents,
  ServerToClientEvents,
} from './interface/socket-event.types';
import { SocketService } from './socket.service';

@UseGuards(WsJwtGuard)
@UseFilters(WsExceptionFilter)
@UsePipes(new ValidationPipe({ whitelist: true }))
@WebSocketGateway({
  namespace: '/socket',
  // 生产环境请改为具体域名 URL，如 cors: { origin: 'https://example.com' }
  cors: { origin: '*' },
})
export class SocketGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server<ClientToServerEvents, ServerToClientEvents>;

  private readonly logger = new Logger(SocketGateway.name);

  constructor(
    private readonly socketService: SocketService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
  ) {}

  async handleConnection(client: AuthSocket): Promise<void> {
    this.logger.log(`New client connected: ${client.id}`);

    const token = extractWsToken(client);
    if (!token) {
      this.rejectClient(client);
      return;
    }

    try {
      const payload = this.jwtService.verify<JwtPayload>(token, {
        secret: getConfig(this.configService).jwt.secret,
      });

      if (payload.type !== TokenType.ACCESS) {
        this.rejectClient(client);
        return;
      }

      const user = await this.usersService.findOne({ id: payload.sub });
      if (!user) {
        this.rejectClient(client);
        return;
      }

      client.user = user;

      this.socketService.handleConnection(client, user);

      client.emit('connected', {
        message: `Welcome, ${user.displayName}!`,
        userId: user.id,
        username: user.username,
      });

      client.broadcast.emit('user-joined', {
        userId: user.id,
        username: user.username,
        displayName: user.displayName,
      });
    } catch (error) {
      this.logger.warn(
        `Authentication failed for client ${client.id}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      this.rejectClient(client);
    }
  }

  private rejectClient(client: AuthSocket): void {
    void client.emit('exception', { status: 401, message: 'Invalid token' });
    void client.disconnect();
  }

  handleDisconnect(client: AuthSocket): void {
    const { user } = client;
    if (user) {
      this.socketService.handleDisconnect(client, user);
      this.server.emit('user-left', {
        userId: user.id,
        username: user.username,
      });
    }
  }

  @SubscribeMessage('join-room')
  async handleJoinRoom(
    @ConnectedSocket() client: AuthSocket,
    @MessageBody() data: JoinRoomDto,
  ): Promise<AckResponse> {
    const { user } = client;
    if (!user) return { success: false, message: 'Not authenticated' };

    await client.join(data.room);
    this.logger.log(`${user.username} joined room: ${data.room}`);

    client.emit('room-joined', { room: data.room });
    client.to(data.room).emit('room-user-joined', {
      room: data.room,
      userId: user.id,
      username: user.username,
    });

    return { success: true };
  }

  @SubscribeMessage('leave-room')
  async handleLeaveRoom(
    @ConnectedSocket() client: AuthSocket,
    @MessageBody() data: LeaveRoomDto,
  ): Promise<AckResponse> {
    const { user } = client;
    if (!user) return { success: false, message: 'Not authenticated' };

    await client.leave(data.room);
    this.logger.log(`${user.username} left room: ${data.room}`);

    client.emit('room-left', { room: data.room });
    client.to(data.room).emit('room-user-left', {
      room: data.room,
      userId: user.id,
      username: user.username,
    });

    return { success: true };
  }

  @SubscribeMessage('send-to-room')
  handleSendToRoom(
    @ConnectedSocket() client: AuthSocket,
    @MessageBody() data: SendToRoomDto,
  ): AckResponse {
    const { user } = client;
    if (!user) return { success: false, message: 'Not authenticated' };

    this.logger.log(`${user.username} -> room ${data.room}: ${data.message}`);

    client.to(data.room).emit('room-message', {
      room: data.room,
      message: data.message,
      senderId: user.id,
      senderUsername: user.username,
      senderDisplayName: user.displayName,
      timestamp: new Date().toISOString(),
    });

    return { success: true };
  }

  @SubscribeMessage('send-to-user')
  handleSendToUser(
    @ConnectedSocket() client: AuthSocket,
    @MessageBody() data: SendToUserDto,
  ): AckResponse {
    const { user } = client;
    if (!user) return { success: false, message: 'Not authenticated' };

    const targetSockets = this.socketService.getUserSockets(data.targetUserId);

    if (!targetSockets || targetSockets.size === 0) {
      return { success: false, message: 'Target user is not connected' };
    }

    const payload = {
      message: data.message,
      senderId: user.id,
      senderUsername: user.username,
      senderDisplayName: user.displayName,
      timestamp: new Date().toISOString(),
    };

    for (const socket of targetSockets) {
      socket.emit('direct-message', payload);
    }

    return { success: true };
  }

  @SubscribeMessage('broadcast')
  handleBroadcast(
    @ConnectedSocket() client: AuthSocket,
    @MessageBody() data: BroadcastDto,
  ): AckResponse {
    const { user } = client;
    if (!user) return { success: false, message: 'Not authenticated' };

    this.logger.log(`${user.username} broadcast: ${data.message}`);

    client.broadcast.emit('broadcast-message', {
      message: data.message,
      senderId: user.id,
      senderUsername: user.username,
      senderDisplayName: user.displayName,
      timestamp: new Date().toISOString(),
    });

    return { success: true };
  }
}
