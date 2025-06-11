import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

/**
 * TODO: 日志系统代办
 * 将日志系统与异常过滤器结合，将异常信息记录到日志系统中
 * 制作成接口，以便在 UI 中展示
 * 接口权限控制仅限 developer Role 使用
 */

@Catch()
export class GlobalExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const responseBody = {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
      error: 'Unknown error',
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    if (exception instanceof HttpException) {
      const exceptionResponse = exception.getResponse();

      responseBody.statusCode = exception.getStatus();

      if (typeof exceptionResponse === 'object') {
        responseBody.message = (exceptionResponse as any).message;
        responseBody.error = (exceptionResponse as any).error;
      } else {
        responseBody.message = exceptionResponse;
        responseBody.error = exception.name;
      }
    } else if (exception instanceof Error) {
      // TODO：生产环境需要隐藏错误信息
      responseBody.message = exception.message;
      responseBody.error = exception.name;
    }

    this.logger.error(
      `[${request.method}] ${request.url} ${responseBody.statusCode} Message: ${responseBody.message} Error: ${responseBody.error}`,
      (exception as Error).stack,
    );

    response.status(responseBody.statusCode).json(responseBody);
  }
}
