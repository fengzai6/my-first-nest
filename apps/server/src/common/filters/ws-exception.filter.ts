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

    // NOTE: WsException 目前只来自鉴权失败这类客户端问题，不是服务端故障，记 warn 避免混入 error 告警。
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
