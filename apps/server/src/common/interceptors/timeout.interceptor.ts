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
import { SKIP_TIMEOUT_KEY } from '@/common/decorators/skip-timeout.decorator';

@Injectable()
export class TimeoutInterceptor implements NestInterceptor {
  constructor(private readonly app: INestApplication) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const { server } = getAppConfig(this.app);
    const handler =
      typeof context.getHandler === 'function'
        ? context.getHandler()
        : undefined;

    if (handler && Reflect.getMetadata(SKIP_TIMEOUT_KEY, handler) === true) {
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
