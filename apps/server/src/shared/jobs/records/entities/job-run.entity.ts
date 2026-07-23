import { BaseEntity } from '@/shared/entity/base.entity';
import { Column, Entity, Index } from 'typeorm';
import {
  JOB_STATUS,
  JOB_TRIGGER_TYPE,
  JobStatus,
  JobTriggerType,
} from '../../constants/job.constants';

@Entity('job_runs')
@Index(['status', 'createdAt'])
@Index(['name', 'createdAt'])
export class JobRun extends BaseEntity {
  @Column({ type: 'varchar', length: 128 })
  name: string;

  @Column({ type: 'varchar', length: 64, default: 'default' })
  queueName: string;

  @Index()
  @Column({ type: 'varchar', length: 128, nullable: true })
  bullJobId: string | null;

  @Column({ type: 'varchar', length: 32, default: JOB_TRIGGER_TYPE.MANUAL })
  triggerType: JobTriggerType;

  @Column({ type: 'varchar', length: 32, default: JOB_STATUS.QUEUED })
  status: JobStatus;

  @Column({ type: 'int', default: 0 })
  progress: number;

  @Column({ type: 'jsonb', nullable: true })
  payload: object | null;

  @Column({ type: 'jsonb', nullable: true })
  result: object | null;

  @Column({ type: 'text', nullable: true })
  errorMessage: string | null;

  @Column({ type: 'int', default: 0 })
  attemptsMade: number;

  @Column({ type: 'int', default: 1 })
  maxAttempts: number;

  @Column({ type: 'timestamptz', nullable: true })
  startedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  finishedAt: Date | null;

  @Column({ type: 'bigint', nullable: true })
  createdBy: string | null;
}
