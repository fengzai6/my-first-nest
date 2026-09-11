import { LoggerService } from '@/shared/log/logger.service';
import { INestApplication } from '@nestjs/common';
import { GlobalExceptionsFilter } from './global-exception.filter';

export const useFilters = (app: INestApplication) => {
  app.useGlobalFilters(new GlobalExceptionsFilter(app.get(LoggerService)));
};
