import { INestApplication } from '@nestjs/common';
import { GlobalExceptionsFilter } from './global-exception.filter';

export const useFilters = (app: INestApplication) => {
  app.useGlobalFilters(new GlobalExceptionsFilter());
};
