import { INestApplication, ValidationPipe } from '@nestjs/common';

export const usePipes = (app: INestApplication) => {
  app.useGlobalPipes(new ValidationPipe());
};
