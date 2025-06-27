import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(
    context: ExecutionContext,
    next: CallHandler<any>,
  ): Observable<any> | Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();

    const { method, url } = request;

    this.logger.log(
      `🚀 \x1b[32m请求开始\x1b[0m \x1b[33m${method}\x1b[0m \x1b[36m${url}\x1b[0m`,
    );

    const startTime = Date.now();

    return next.handle().pipe(
      tap((data) => {
        const duration = Date.now() - startTime;

        this.logger.log(
          `✅ \x1b[32m请求结束\x1b[0m \x1b[33m${method}\x1b[0m \x1b[36m${url}\x1b[0m - \x1b[35m耗时: ${duration}ms\x1b[0m`,
        );
      }),
    );
  }
}
