import { User } from '@/modules/users/entities/user.entity';
import { BaseEntity } from '@/shared/entity/base.entity';
import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import {
  DOCUMENT_STATUS,
  DocumentStatus,
} from '../constants/document.constants';

@Entity('documents')
@Index(['owner', 'deletedAt', 'createdAt'])
@Index(['status', 'deletedAt', 'createdAt'])
export class Document extends BaseEntity {
  @Column({ length: 200 })
  title: string;

  @Column({ type: 'text' })
  content: string;

  @Column({
    type: 'varchar',
    length: 16,
    default: DOCUMENT_STATUS.DRAFT,
  })
  status: DocumentStatus;

  @ManyToOne(() => User, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'owner_id' })
  owner: User;
}
