import { User } from '@/modules/users/entities/user.entity';
import { BaseEntity } from '@/shared/entity/base.entity';
import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import {
  ATTACHMENT_STORAGE_PROVIDER,
  ATTACHMENT_VISIBILITY,
  AttachmentStorageProvider,
  AttachmentVisibility,
} from '../constants/attachment.constants';

@Entity('attachments')
@Index('IDX_attachments_cleanup_deleted', ['deletedAt', 'createdAt', 'id'])
@Index('IDX_attachments_orphan_cleanup', [
  'bizType',
  'bizId',
  'deletedAt',
  'createdAt',
])
@Index(['uploadedBy', 'visibility', 'deletedAt'])
export class Attachment extends BaseEntity {
  @Column({ length: 255 })
  originalName: string;

  @Column({ length: 500, unique: true })
  storageKey: string;

  @Column({ length: 127 })
  mimeType: string;

  @Column({ type: 'integer' })
  size: number;

  @Column({
    type: 'varchar',
    length: 16,
    default: ATTACHMENT_VISIBILITY.PRIVATE,
  })
  visibility: AttachmentVisibility;

  @Column({
    type: 'varchar',
    length: 32,
    default: ATTACHMENT_STORAGE_PROVIDER.LOCAL,
  })
  storageProvider: AttachmentStorageProvider;

  @Column({ type: 'varchar', length: 64, nullable: true })
  bizType: string | null;

  @Column({ type: 'bigint', nullable: true })
  bizId: string | null;

  @ManyToOne(() => User, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'uploaded_by_id' })
  uploadedBy: User;
}
