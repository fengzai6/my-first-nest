import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    let res;

    if (typeof exceptionResponse === 'object') {
      res = exceptionResponse;
    } else {
      res = {
        statusCode: status,
        message: String(exceptionResponse),
      };
    }

    response.status(status).json({
      ...res,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
