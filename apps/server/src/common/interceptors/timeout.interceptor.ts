import { getAppConfig } from '@/config/configuration';
import {
  CallHandler,
  ExecutionContext,
  GatewayTimeoutException,
  HttpStatus,
  INestApplication,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, throwError, TimeoutError } from 'rxjs';
import { catchError, timeout } from 'rxjs/operators';
import { Request } from 'express';

@Injectable()
export class TimeoutInterceptor implements NestInterceptor {
  constructor(private readonly app: INestApplication) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const { server } = getAppConfig(this.app);
    const request =
      typeof context.switchToHttp === 'function'
        ? context.switchToHttp().getRequest<Request>()
        : undefined;

    if (request?.headers?.accept?.includes('text/event-stream')) {
      return next.handle();
    }

    return next.handle().pipe(
      timeout(server.timeout * 1000),
      catchError((err: Error) => {
        if (err instanceof TimeoutError) {
          return throwError(
            () =>
              new GatewayTimeoutException({
                message: '请求超时，服务器处理时间过长',
                statusCode: HttpStatus.GATEWAY_TIMEOUT,
              }),
          );
        }
        return throwError(() => err);
      }),
    );
  }
}
