import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { defaultConfig } from './config.default';
import { developmentConfig } from './env/config.development';
import { productionConfig } from './env/config.production';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [
        defaultConfig,
        process.env.NODE_ENV === 'production'
          ? productionConfig
          : developmentConfig,
      ],
    }),
  ],
})
export class AppConfigModule {}
