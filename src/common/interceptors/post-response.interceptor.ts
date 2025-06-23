import {
  CallHandler,
  ExecutionContext,
  HttpStatus,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Response } from 'express';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable()
export class PostResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const httpContext = context.switchToHttp();
    const response = httpContext.getResponse<Response>();
    const request = httpContext.getRequest<Request>();

    if (request.method === 'POST') {
      return next.handle().pipe(
        map((data) => {
          if (response.statusCode === HttpStatus.CREATED) {
            response.status(HttpStatus.OK);
          }
          return data;
        }),
      );
    }
  }
}
