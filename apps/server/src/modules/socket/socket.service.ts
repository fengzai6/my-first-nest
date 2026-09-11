import { LOG_CATEGORY } from '@/shared/log/constants/log.constants';
import { LoggerService } from '@/shared/log/logger.service';
import { Injectable } from '@nestjs/common';
import { Socket } from 'socket.io';
import { User } from '../users/entities/user.entity';

@Injectable()
export class SocketService {
  constructor(private readonly logger: LoggerService) {}

  // TODO: 当前使用内存 Map，仅适用于单实例部署。多实例需使用 @socket.io/redis-adapter
  private connectedClients = new Map<string, Set<Socket>>();

  handleConnection(client: Socket, user: User): void {
    if (!this.connectedClients.has(user.id)) {
      this.connectedClients.set(user.id, new Set());
    }
    this.connectedClients.get(user.id)!.add(client);
    this.logger.log('Socket client connected', {
      category: LOG_CATEGORY.SOCKET,
      context: {
        socketId: client.id,
        userId: user.id,
        username: user.username,
      },
    });
  }

  handleDisconnect(client: Socket, user: User): void {
    const sockets = this.connectedClients.get(user.id);
    if (sockets) {
      sockets.delete(client);
      if (sockets.size === 0) {
        this.connectedClients.delete(user.id);
      }
    }
    this.logger.log('Socket client disconnected', {
      category: LOG_CATEGORY.SOCKET,
      context: {
        socketId: client.id,
        userId: user.id,
        username: user.username,
      },
    });
  }

  getConnectedUserIds(): string[] {
    return Array.from(this.connectedClients.keys());
  }

  getUserSockets(userId: string): Set<Socket> | undefined {
    return this.connectedClients.get(userId);
  }

  isConnected(userId: string): boolean {
    return this.connectedClients.has(userId);
  }
}
