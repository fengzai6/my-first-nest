import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { appGuards } from './common/guards/app-guards';
import { AppConfigModule } from './config/config.module';
import { modules } from './modules';
import { RedisCacheModule } from './shared/caching/cache.module';
import { JobsModule } from './shared/jobs/jobs.module';
import { DatabaseModule } from './shared/database/database.module';
import { StaticModule } from './shared/static/static.module';
import { ThrottlerConfigModule } from './shared/throttler/throttler.module';

@Module({
  imports: [
    AppConfigModule,
    DatabaseModule,
    RedisCacheModule,
    JobsModule,
    ThrottlerConfigModule,
    StaticModule,
    ...modules,
  ],
  controllers: [AppController],
  providers: [AppService, ...appGuards],
})
export class AppModule {}
