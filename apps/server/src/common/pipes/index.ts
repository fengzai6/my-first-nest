import { INestApplication, ValidationPipe } from '@nestjs/common';

export const usePipes = (app: INestApplication) => {
  // transform: true —— @Query 字符串自动按 DTO 上的 @Type 转换为 number/boolean，
  // 否则 class-validator 的 @IsInt 等校验在 query 参数上无效。
  app.useGlobalPipes(new ValidationPipe({ transform: true }));
};
