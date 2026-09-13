import { getConfig } from '@/config/configuration';
import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Queue } from 'bullmq';
import { LOG_QUEUE } from './constants/log.constants';
import type { ILogBatchJobData, ILogEvent } from './interfaces/log.interface';

const MAX_BUFFERED_EVENTS = 5000;

@Injectable()
export class LogQueueService implements OnModuleDestroy {
  private readonly events: ILogEvent[] = [];
  private readonly batchSize: number;
  private readonly flushIntervalMs: number;
  private flushTimer: NodeJS.Timeout | null = null;
  private isFlushing = false;
  private flushPromise: Promise<void> | null = null;
  private isShuttingDown = false;

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
    if (this.isShuttingDown) {
      return;
    }

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
    this.isShuttingDown = true;
    this.clearFlushTimer();

    await this.flush();

    if (this.events.length === 0) {
      return;
    }

    const droppedCount = this.events.length;
    this.events.length = 0;
    process.stderr.write(
      `Dropped ${droppedCount} buffered log events during shutdown because the queue remained unavailable\n`,
    );
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
      // NOTE: 回填到缓冲区头部保持顺序，等下次 flush 重试；不抛出，日志失败不能影响业务。
      const availableSlots = Math.max(
        MAX_BUFFERED_EVENTS - this.events.length,
        0,
      );
      const retainedEvents = events.slice(0, availableSlots);
      const droppedCount = events.length - retainedEvents.length;

      this.events.unshift(...retainedEvents);
      process.stderr.write(
        `Failed to enqueue log batch: ${
          error instanceof Error ? error.message : String(error)
        }\n`,
      );
      if (droppedCount > 0) {
        process.stderr.write(
          `Dropped ${droppedCount} buffered log events after reaching the ${MAX_BUFFERED_EVENTS} event limit\n`,
        );
      }
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
