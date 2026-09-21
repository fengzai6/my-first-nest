import { requestContextStorage } from '@/common/context/request-context';
import { IsDev } from '@/common/constants/environment';
import { generateSnowflakeId } from '@/shared/utils/snowflake';
import { Injectable } from '@nestjs/common';
import { formatConsoleLogEvent } from './console-log.formatter';
import { LOG_CATEGORY, LOG_LEVEL, LogLevel } from './constants/log.constants';
import type { ILogEvent, ILogWriteOptions } from './interfaces/log.interface';
import { LogQueueService } from './log-queue.service';

/**
 * 同步写 stdout（开发 TTY 为多行文本，其他环境为 CLEF JSON），再异步入队持久化；入队失败只写 stderr，不影响业务。
 */
@Injectable()
export class LoggerService {
  constructor(private readonly queue: LogQueueService) {}

  log(message: string, options: ILogWriteOptions = {}): void {
    this.write(LOG_LEVEL.INFO, message, options);
  }

  warn(message: string, options: ILogWriteOptions = {}): void {
    this.write(LOG_LEVEL.WARN, message, options);
  }

  error(
    message: string,
    error?: unknown,
    options: ILogWriteOptions = {},
  ): void {
    this.write(LOG_LEVEL.ERROR, message, {
      ...options,
      stack: this.resolveValue(options.stack, this.stringifyError(error)),
    });
  }

  debug(message: string, options: ILogWriteOptions = {}): void {
    this.write(LOG_LEVEL.DEBUG, message, options);
  }

  private write(
    level: LogLevel,
    message: string,
    options: ILogWriteOptions,
  ): void {
    let event: ILogEvent;

    try {
      const context = requestContextStorage.getStore();
      event = {
        // NOTE: ID 必须在入队前生成，job 重试时同一事件 ID 不变，落库的 orIgnore 才能去重。
        id: generateSnowflakeId(),
        level,
        category: options.category ?? LOG_CATEGORY.BUSINESS,
        message,
        context: options.context ?? null,
        requestId: this.resolveValue(
          options.requestId,
          context?.requestId ?? null,
        ),
        userId: this.resolveValue(options.userId, context?.userId ?? null),
        ip: this.resolveValue(options.ip, context?.ip ?? null),
        method: this.resolveValue(options.method, context?.method ?? null),
        url: this.resolveValue(options.url, context?.url ?? null),
        statusCode: options.statusCode ?? null,
        duration: options.duration ?? null,
        stack: options.stack ?? null,
        timestamp: options.timestamp ?? new Date(),
      };

      process.stdout.write(
        `${formatConsoleLogEvent(event, {
          pretty: IsDev && Boolean(process.stdout.isTTY),
          color: Boolean(process.stdout.isTTY),
        })}\n`,
      );
      this.queue.enqueue(event);
    } catch (error) {
      process.stderr.write(
        `Failed to create or enqueue log: ${
          error instanceof Error ? error.message : String(error)
        }\n`,
      );
    }
  }

  private resolveValue<T>(
    value: T | null | undefined,
    fallback: T | null,
  ): T | null {
    return value !== undefined ? value : fallback;
  }

  private stringifyError(error: unknown): string | null {
    if (error === undefined || error === null) {
      return null;
    }

    if (error instanceof Error) {
      return error.stack ?? error.message;
    }

    try {
      return JSON.stringify(error) ?? 'Unserializable error';
    } catch {
      return 'Unserializable error';
    }
  }
}
