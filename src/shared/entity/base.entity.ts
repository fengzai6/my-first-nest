import { Exclude } from 'class-transformer';
import {
  BeforeInsert,
  CreateDateColumn,
  DeleteDateColumn,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { generateSnowflakeId } from '../utils';

/**
 * 基础实体类
 * 抽象类，不能实例化，只能被继承
 */
export abstract class BaseEntity {
  @PrimaryColumn({ type: 'bigint' })
  id: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // 软删除
  @Exclude()
  @DeleteDateColumn()
  deletedAt: Date;
  // Or
  // @Column({
  //   default: false,
  // })
  // isDeleted: boolean;

  @BeforeInsert()
  generateId() {
    if (!this.id) {
      this.id = generateSnowflakeId();
    }
  }
}
