import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import {
  serverConfig,
  swaggerConfig,
  jwtConfig,
  databaseConfig,
} from './configuration';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [serverConfig, swaggerConfig, jwtConfig, databaseConfig],
    }),
  ],
})
export class AppConfigModule {}
