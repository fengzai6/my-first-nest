import { LOG_CATEGORY } from '@/shared/log/constants/log.constants';
import { LoggerService } from '@/shared/log/logger.service';
import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';

@Catch(WsException)
export class WsExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: LoggerService) {}

  catch(exception: WsException, host: ArgumentsHost): void {
    const client = host.switchToWs().getClient<Socket>();
    const error = exception.getError();

    const response =
      typeof error === 'string' ? { status: 'error', message: error } : error;

    this.logger.warn('WebSocket exception', {
      category: LOG_CATEGORY.SOCKET,
      context: {
        socketId: client.id,
        error: response,
      },
    });
    client.emit('exception', response);
  }
}
