import { requestContextStorage } from '@/common/context/request-context';
import { LOG_CATEGORY } from '@/shared/log/constants/log.constants';
import { LoggerService } from '@/shared/log/logger.service';
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { IsProduction } from '../constants/environment';
import { BaseException } from '../exceptions/base.exception';

/**
 * 全局异常过滤器
 * 处理所有未捕获的异常，并将其转换为统一的响应格式
 */
@Catch()
export class GlobalExceptionsFilter implements ExceptionFilter {
  constructor(private readonly logger: LoggerService) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const responseBody = {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
      code: 'INTERNAL_SERVER_ERROR',
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    if (exception instanceof BaseException) {
      // 处理自定义异常
      const exceptionResponse = exception.getResponse() as {
        message: string;
        code: string;
      };

      responseBody.statusCode = exception.getStatus();
      responseBody.message = exceptionResponse.message;
      responseBody.code = exceptionResponse.code || exception.name;
    } else if (exception instanceof HttpException) {
      const exceptionResponse = exception.getResponse();
      responseBody.statusCode = exception.getStatus();

      if (typeof exceptionResponse === 'object') {
        const exceptionObj = exceptionResponse as {
          message: string | string[];
          error: string;
        };

        responseBody.message = Array.isArray(exceptionObj.message)
          ? exceptionObj.message.join(', ')
          : exceptionObj.message;
        responseBody.code = exceptionObj.error;
      } else {
        responseBody.message = exceptionResponse;
        responseBody.code = exception.name;
      }
    } else if (exception instanceof Error) {
      if (!IsProduction) {
        responseBody.message = exception.message;
      }
      responseBody.code = exception.name;
    }

    const context = requestContextStorage.getStore();

    this.logger.error('HTTP request failed', exception, {
      category: LOG_CATEGORY.HTTP,
      method: request.method,
      url: request.originalUrl ?? request.url,
      ip: request.ip,
      statusCode: responseBody.statusCode,
      duration: context ? Date.now() - context.startedAt : null,
      context: { code: responseBody.code },
    });

    response.status(responseBody.statusCode).json(responseBody);
  }
}
