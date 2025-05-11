import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { logger } from './common/middleware/logger.middleware';
import { CatsModule } from './modules/cats/cats.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [UsersModule, CatsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      // 应用日志中间件
      .apply(logger)
      // 排除不需要记录日志的路径
      .exclude(
        {
          path: '/swagger',
          method: RequestMethod.ALL,
        },
        {
          path: '/favicon.ico',
          method: RequestMethod.ALL,
        },
      )
      // 使用对象形式配置路由，采用新版路径格式
      .forRoutes({
        path: '/*path',
        method: RequestMethod.ALL,
      });
  }
}
