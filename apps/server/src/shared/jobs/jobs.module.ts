import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JobsController } from './jobs.controller';
import { JobQueueModule } from './queue/job-queue.module';
import { JobQueueService } from './queue/job-queue.service';
import { JobProcessor } from './queue/job.processor';
import { JobRun } from './records/entities/job-run.entity';
import { JobRecordService } from './records/job-record.service';
import { JobRegistryService } from './registry/job-registry.service';
import { JobService } from './services/job.service';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([JobRun]), JobQueueModule],
  controllers: [JobsController],
  providers: [
    JobRegistryService,
    JobRecordService,
    JobQueueService,
    JobService,
    JobProcessor,
  ],
  exports: [JobRegistryService, JobRecordService, JobService, JobQueueModule],
})
export class JobsModule {}
