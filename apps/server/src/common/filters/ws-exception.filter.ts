import { ArgumentsHost, Catch, ExceptionFilter, Logger } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';

@Catch(WsException)
export class WsExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(WsExceptionFilter.name);

  catch(exception: WsException, host: ArgumentsHost): void {
    const client = host.switchToWs().getClient<Socket>();
    const error = exception.getError();

    const response =
      typeof error === 'string' ? { status: 'error', message: error } : error;

    this.logger.warn(`WsException: ${JSON.stringify(response)}`);
    client.emit('exception', response);
  }
}
