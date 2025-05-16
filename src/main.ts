import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');

  // 为整个应用绑定中间件
  // app.use(logger);
  app.useGlobalPipes(new ValidationPipe());
  app.useGlobalInterceptors(new LoggingInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter());

  const swaggerConfig = new DocumentBuilder()
    .setTitle('NestJS API')
    .setDescription('The NestJS API description')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('swagger', app, document);

  // 使用 '0.0.0.0' 监听所有 IP 地址，但显示 127.0.0.1
  const port = process.env.PORT ?? 8080;
  await app.listen(port);

  // 使用 IPv4 地址显示 URL
  const serverUrl = `http://127.0.0.1:${port}`;

  Logger.log(`\x1b[34mApplication is running on: ${serverUrl}\x1b[0m`);
  Logger.log(`\x1b[34mSwagger is running on: ${serverUrl}/swagger\x1b[0m`);
}
bootstrap();
