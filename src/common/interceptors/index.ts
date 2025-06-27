import { ClassSerializerInterceptor, INestApplication } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { LoggingInterceptor } from './logging.interceptor';
import { PostResponseInterceptor } from './post-response.interceptor';
import { UserContextInterceptor } from './user-context.interceptor';

export const useInterceptors = (app: INestApplication) => {
  app.useGlobalInterceptors(
    new LoggingInterceptor(),
    new PostResponseInterceptor(),
    new UserContextInterceptor(),
    new ClassSerializerInterceptor(app.get(Reflector)),
  );
};
