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
    // NOTE: Date 经 BullMQ 的 JSON 序列化后变成 ISO 字符串，这里还原。
    const events = job.data.events.map((event) => ({
      ...event,
      timestamp: new Date(event.timestamp),
    }));

    // NOTE: 先落库再投 Seq，任一步失败整个 job 按 attempts 重试；落库靠 orIgnore 去重，Seq 无幂等会出现重复事件。
    await this.logs.insertIgnoreConflicts(events);
    await this.seqTransport.send(events);
  }
}
