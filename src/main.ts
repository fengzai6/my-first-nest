import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { appUse } from './common/use';
import { getAppConfig } from './config/configuration';
import { useSwagger } from './shared/utils/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = getAppConfig(app);

  console.log(config);

  app.setGlobalPrefix(config.server.apiPrefix);

  // 为整个应用绑定中间件
  appUse(app);

  useSwagger(app);

  await app.listen(config.server.port);

  const serverUrl = `http://127.0.0.1:${config.server.port}`;

  Logger.log(`\x1b[34mApplication is running on: ${serverUrl}\x1b[0m`);
  Logger.log(
    `\x1b[34mSwagger is running on: ${serverUrl}/${config.swagger.path}\x1b[0m`,
  );
}
bootstrap();
