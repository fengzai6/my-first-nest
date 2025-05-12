import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { logger } from './common/middleware/logger.middleware';
import { CatsModule } from './modules/cats/cats.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    UsersModule,
    CatsModule,
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.DATABASE_URL,
      entities: [__dirname + '/**/*.entity{.ts,.js}'],
      synchronize: true,
      ssl: false,
    }),
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
