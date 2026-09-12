import { Column, Entity, Index, PrimaryColumn } from 'typeorm';
import { LogLevel } from '../constants/log.constants';

/**
 * 不继承 BaseEntity：日志只追加不修改，也不软删除（量大，由 CleanupExpiredLogsScheduler 物理清理）。
 * 复合索引等值列在前、timestamp 在后，同一索引同时覆盖条件筛选和按时间倒序分页。
 */
@Entity('log_records')
@Index('IDX_log_records_timestamp', ['timestamp'])
@Index('IDX_log_records_level_timestamp', ['level', 'timestamp'])
@Index('IDX_log_records_category_timestamp', ['category', 'timestamp'])
@Index('IDX_log_records_user_id_timestamp', ['userId', 'timestamp'])
@Index('IDX_log_records_request_id', ['requestId'])
export class LogRecord {
  @PrimaryColumn({ type: 'bigint' })
  id: string;

  @Column({ type: 'varchar', length: 16 })
  level: LogLevel;

  @Column({ type: 'varchar', length: 64 })
  category: string;

  @Column({ type: 'text' })
  message: string;

  @Column({ type: 'jsonb', nullable: true })
  context: Record<string, unknown> | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  requestId: string | null;

  @Column({ type: 'bigint', nullable: true })
  userId: string | null;

  @Column({ type: 'varchar', length: 45, nullable: true })
  ip: string | null;

  @Column({ type: 'varchar', length: 10, nullable: true })
  method: string | null;

  @Column({ type: 'text', nullable: true })
  url: string | null;

  @Column({ type: 'smallint', nullable: true })
  statusCode: number | null;

  @Column({ type: 'integer', nullable: true })
  duration: number | null;

  @Column({ type: 'text', nullable: true })
  stack: string | null;

  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  timestamp: Date;
}
