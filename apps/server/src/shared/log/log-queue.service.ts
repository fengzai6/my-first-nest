import { getConfig } from '@/config/configuration';
import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Queue } from 'bullmq';
import { LOG_QUEUE } from './constants/log.constants';
import type { ILogBatchJobData, ILogEvent } from './interfaces/log.interface';

@Injectable()
export class LogQueueService implements OnModuleDestroy {
  private readonly events: ILogEvent[] = [];
  private readonly batchSize: number;
  private readonly flushIntervalMs: number;
  private flushTimer: NodeJS.Timeout | null = null;
  private isFlushing = false;
  private flushPromise: Promise<void> | null = null;

  constructor(
    @InjectQueue(LOG_QUEUE.NAME)
    private readonly queue: Queue<ILogBatchJobData>,
    configService: ConfigService,
  ) {
    const config = getConfig(configService).log;
    this.batchSize = config.batchSize;
    this.flushIntervalMs = config.flushIntervalMs;
  }

  enqueue(event: ILogEvent): void {
    this.events.push(event);

    if (this.events.length >= this.batchSize) {
      void this.flush();
      return;
    }

    this.scheduleFlush();
  }

  async flush(): Promise<void> {
    if (this.isFlushing) {
      await this.flushPromise;
      return;
    }

    if (this.events.length === 0) {
      this.clearFlushTimer();
      return;
    }

    this.clearFlushTimer();
    this.isFlushing = true;
    this.flushPromise = this.flushBatch();

    try {
      await this.flushPromise;
    } finally {
      this.isFlushing = false;
      this.flushPromise = null;
    }

    if (this.events.length > 0) {
      this.scheduleFlush();
    }
  }

  async onModuleDestroy(): Promise<void> {
    this.clearFlushTimer();
    await this.flush();
  }

  private async flushBatch(): Promise<void> {
    const events = this.events.splice(0, this.events.length);

    try {
      await this.queue.add(
        LOG_QUEUE.JOB_NAME,
        {
          events: events.map((event) => ({
            ...event,
            timestamp: event.timestamp.toISOString(),
          })),
        },
        {
          attempts: 3,
          backoff: { type: 'fixed', delay: 1000 },
          removeOnComplete: { count: 1000 },
          removeOnFail: { count: 5000 },
        },
      );
    } catch (error) {
      this.events.unshift(...events);
      process.stderr.write(
        `Failed to enqueue log batch: ${
          error instanceof Error ? error.message : String(error)
        }\n`,
      );
    }
  }

  private scheduleFlush(): void {
    if (this.flushTimer || this.isFlushing) {
      return;
    }

    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      void this.flush();
    }, this.flushIntervalMs);
  }

  private clearFlushTimer(): void {
    if (!this.flushTimer) {
      return;
    }

    clearTimeout(this.flushTimer);
    this.flushTimer = null;
  }
}
