import {
  CreateDateColumn,
  DeleteDateColumn,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * 基础实体类
 * 抽象类，不能实例化，只能被继承
 */
export abstract class BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // 软删除
  @DeleteDateColumn()
  deletedAt: Date;
  // Or
  // @Column({
  //   default: false,
  // })
  // isDeleted: boolean;
}
