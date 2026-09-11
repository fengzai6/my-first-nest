import { SpecialRolesGuard } from '@/common/guards/special-roles.guard';
import { BullModule } from '@nestjs/bullmq';
import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JobQueueModule } from '../jobs/queue/job-queue.module';
import { LOG_QUEUE } from './constants/log.constants';
import { LogRecord } from './entities/log-record.entity';
import { LogController } from './log.controller';
import { LogProcessor } from './log.processor';
import { LogQueueService } from './log-queue.service';
import { LogService } from './log.service';
import { LoggerService } from './logger.service';
import { SeqTransportService } from './seq-transport.service';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([LogRecord]),
    JobQueueModule,
    BullModule.registerQueue({ name: LOG_QUEUE.NAME }),
  ],
  controllers: [LogController],
  providers: [
    LogService,
    LoggerService,
    LogQueueService,
    LogProcessor,
    SeqTransportService,
    SpecialRolesGuard,
  ],
  exports: [LogService, LoggerService],
})
export class LogModule {}
