import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { logger } from './common/middleware/logger.middleware';
import { AppConfigModule } from './config/config.module';
import { AuthModule } from './modules/auth/auth.module';
import { CatsModule } from './modules/cats/cats.module';
import { UsersModule } from './modules/users/users.module';
import { DatabaseModule } from './shared/database/database.module';

@Module({
  imports: [
    AppConfigModule,
    DatabaseModule,
    UsersModule,
    CatsModule,
    AuthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
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
