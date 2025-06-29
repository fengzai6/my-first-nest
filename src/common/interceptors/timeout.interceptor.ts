import { getAppConfig } from '@/config/configuration';
import {
  CallHandler,
  ExecutionContext,
  INestApplication,
  Injectable,
  NestInterceptor,
  RequestTimeoutException,
} from '@nestjs/common';
import { Observable, throwError, TimeoutError } from 'rxjs';
import { catchError, timeout } from 'rxjs/operators';

@Injectable()
export class TimeoutInterceptor implements NestInterceptor {
  constructor(private readonly app: INestApplication) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const { server } = getAppConfig(this.app);

    return next.handle().pipe(
      timeout(server.timeout * 1000),
      catchError((err) => {
        if (err instanceof TimeoutError) {
          return throwError(
            () =>
              new RequestTimeoutException(
                '请求超时，服务器处理时间过长',
                '504',
              ),
          );
        }
        return throwError(() => err);
      }),
    );
  }
}
