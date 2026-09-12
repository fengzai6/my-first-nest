import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, type QueryDeepPartialEntity } from 'typeorm';
import {
  ErrorException,
  ErrorExceptionCode,
} from '@/common/exceptions/error.exception';
import { LogRecord } from './entities/log-record.entity';
import type {
  ILogEvent,
  ILogPage,
  IQueryLogs,
} from './interfaces/log.interface';

const MAX_BIGINT = 9223372036854775807n;

@Injectable()
export class LogService {
  constructor(
    @InjectRepository(LogRecord)
    private readonly repository: Repository<LogRecord>,
  ) {}

  async insertIgnoreConflicts(events: readonly ILogEvent[]): Promise<void> {
    if (events.length === 0) {
      return;
    }

    await this.repository
      .createQueryBuilder()
      .insert()
      .into(LogRecord)
      .values([...events] as QueryDeepPartialEntity<LogRecord>[])
      // NOTE: 主键冲突静默忽略，job 重试时同一批事件不会重复落库。
      .orIgnore()
      .execute();
  }

  async purgeBefore(timestamp: Date): Promise<number> {
    const result = await this.repository
      .createQueryBuilder()
      .delete()
      .from(LogRecord)
      .where('timestamp < :timestamp', { timestamp })
      .execute();

    return result.affected ?? 0;
  }

  async list(query: IQueryLogs): Promise<ILogPage> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const queryBuilder = this.repository.createQueryBuilder('log');

    if (query.level) {
      queryBuilder.andWhere('log.level = :level', { level: query.level });
    }
    if (query.category) {
      queryBuilder.andWhere('log.category = :category', {
        category: query.category,
      });
    }
    if (query.userId) {
      queryBuilder.andWhere('log.userId = :userId', { userId: query.userId });
    }
    if (query.requestId) {
      queryBuilder.andWhere('log.requestId = :requestId', {
        requestId: query.requestId,
      });
    }
    if (query.startTime) {
      queryBuilder.andWhere('log.timestamp >= :startTime', {
        startTime: query.startTime,
      });
    }
    if (query.endTime) {
      queryBuilder.andWhere('log.timestamp <= :endTime', {
        endTime: query.endTime,
      });
    }
    if (query.keyword) {
      // NOTE: ILIKE 走不了索引，会全表扫；只在管理员排查时使用，可接受。
      queryBuilder.andWhere('log.message ILIKE :keyword', {
        keyword: `%${query.keyword}%`,
      });
    }

    const [items, total] = await queryBuilder
      .orderBy('log.timestamp', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    return { items, total, page, pageSize };
  }

  async getById(id: string): Promise<ILogEvent> {
    if (!/^\d+$/.test(id) || BigInt(id) > MAX_BIGINT) {
      throw new ErrorException(ErrorExceptionCode.LOG_NOT_FOUND);
    }

    const record = await this.repository.findOneBy({ id });
    if (!record) {
      throw new ErrorException(ErrorExceptionCode.LOG_NOT_FOUND);
    }

    return record;
  }
}
