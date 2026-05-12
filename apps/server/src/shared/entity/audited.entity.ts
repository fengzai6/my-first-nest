import type { User } from '@/modules/users/entities';
import { Exclude } from 'class-transformer';
import { JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from './base.entity';

/**
 * 审计实体类
 * 包含创建者和更新者
 */
export abstract class AuditedEntity extends BaseEntity {
  @Exclude()
  @ManyToOne('User', { nullable: true }) // 使用字符串形式引用实体，避免循环依赖
  @JoinColumn({ name: 'created_by_id' })
  createdBy: User;

  @Exclude()
  @ManyToOne('User', { nullable: true })
  @JoinColumn({ name: 'updated_by_id' })
  updatedBy: User;
}
