import { LoggerService } from '@/shared/log/logger.service';
import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Observable, tap } from 'rxjs';
import { LOG_CATEGORY } from '../../shared/log/constants/log.constants';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(private readonly logger: LoggerService) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler<unknown>,
  ): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const startTime = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          this.logger.log('HTTP request completed', {
            category: LOG_CATEGORY.HTTP,
            method: request.method,
            url: request.originalUrl ?? request.url,
            ip: request.ip,
            statusCode: response.statusCode,
            duration: Date.now() - startTime,
          });
        },
      }),
    );
  }
}
