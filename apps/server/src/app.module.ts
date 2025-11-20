import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { appGuards } from './common/guards/app-guards';
import { AppConfigModule } from './config/config.module';
import { modules } from './modules';
import { DatabaseModule } from './shared/database/database.module';
import { StaticModule } from './shared/static/static.module';

@Module({
  imports: [AppConfigModule, DatabaseModule, StaticModule, ...modules],
  controllers: [AppController],
  providers: [AppService, ...appGuards],
})
export class AppModule {}
