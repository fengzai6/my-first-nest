import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Response } from 'express';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable()
export class PostResponseInterceptor<T> implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler<T>): Observable<T> {
    const httpContext = context.switchToHttp();
    const response = httpContext.getResponse<Response>();
    const request = httpContext.getRequest<Request>();

    if (request.method === 'POST') {
      return next.handle().pipe(
        map((data) => {
          if (response.statusCode === 201) {
            response.status(200);
          }
          return data;
        }),
      );
    }

    return next.handle();
  }
}
