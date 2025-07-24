import { Module } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';

@Module({
  imports: [
    // 需要在 tsconfig.build.json 中排除 client 目录
    ServeStaticModule.forRoot({
      // rootPath: join(__dirname, '..', 'client/dist'),
      // 使用 process.cwd() 获取当前工作目录路径
      rootPath: join(process.cwd(), 'client/dist'),
      // 路径匹配问题：https://github.com/pillarjs/path-to-regexp#errors
      exclude: ['/api/{*path}'],
    }),
  ],
})
export class StaticModule {}
