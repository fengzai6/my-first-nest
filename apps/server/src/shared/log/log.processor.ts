import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { LOG_QUEUE } from './constants/log.constants';
import type { ILogBatchJobData } from './interfaces/log.interface';
import { LogService } from './log.service';
import { SeqTransportService } from './seq-transport.service';

@Processor(LOG_QUEUE.NAME)
export class LogProcessor extends WorkerHost {
  constructor(
    private readonly logs: LogService,
    private readonly seqTransport: SeqTransportService,
  ) {
    super();
  }

  async process(job: Job<ILogBatchJobData>): Promise<void> {
    const events = job.data.events.map((event) => ({
      ...event,
      timestamp: new Date(event.timestamp),
    }));

    await this.logs.insertIgnoreConflicts(events);
    await this.seqTransport.send(events);
  }
}
