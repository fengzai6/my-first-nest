import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { PermissionGuard } from './common/guards/permission.guard';
import { logger } from './common/middleware/logger.middleware';
import { AppConfigModule } from './config/config.module';
import { modules } from './modules';
import { DatabaseModule } from './shared/database/database.module';

@Module({
  imports: [AppConfigModule, DatabaseModule, ...modules],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: PermissionGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      // 应用日志中间件
      .apply(logger)
      // 排除不需要记录日志的路径
      .exclude('/swagger', '/favicon.ico')
      // 使用对象形式配置路由，采用新版路径格式
      .forRoutes('/*path');
  }
}
