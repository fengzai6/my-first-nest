import { IsProduction } from '@/common/constants';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { defaultConfig } from './config.default';
import { validationSchema } from './env.validation';
import { developmentConfig } from './env/config.development';
import { productionConfig } from './env/config.production';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema,
      load: [
        defaultConfig,
        IsProduction ? productionConfig : developmentConfig,
      ],
    }),
  ],
})
export class AppConfigModule {}
