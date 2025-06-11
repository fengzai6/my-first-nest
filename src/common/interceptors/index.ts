import { INestApplication } from '@nestjs/common';
import { LoggingInterceptor } from './logging.interceptor';

export const useInterceptors = (app: INestApplication) => {
  app.useGlobalInterceptors(new LoggingInterceptor());
};
