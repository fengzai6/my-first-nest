import {
  CreateDateColumn,
  JoinColumn,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export class BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @CreateDateColumn()
  @JoinColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn()
  @JoinColumn({ name: 'updated_at' })
  updatedAt: Date;
}
