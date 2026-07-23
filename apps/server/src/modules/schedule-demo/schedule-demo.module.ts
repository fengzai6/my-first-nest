import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { HeartbeatScheduler } from './heartbeat.scheduler';

@Module({
  imports: [ScheduleModule.forRoot()],
  providers: [HeartbeatScheduler],
})
export class ScheduleDemoModule {}
