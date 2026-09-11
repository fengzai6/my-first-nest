import { LoggerService } from '@/shared/log/logger.service';
import { ClassSerializerInterceptor, INestApplication } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { LoggingInterceptor } from './logging.interceptor';
import { PostResponseInterceptor } from './post-response.interceptor';
import { TimeoutInterceptor } from './timeout.interceptor';
import { UserContextInterceptor } from './user-context.interceptor';

export const useInterceptors = (app: INestApplication) => {
  const logger = app.get(LoggerService);

  app.useGlobalInterceptors(
    new UserContextInterceptor(),
    new LoggingInterceptor(logger),
    new PostResponseInterceptor(),
    new ClassSerializerInterceptor(app.get(Reflector)),
    new TimeoutInterceptor(app),
  );
};
