import { BaseEntity } from 'src/shared/entity/base.entity';
import { Column, Entity, ManyToOne } from 'typeorm';
import { User } from '../users/user.entity';

@Entity()
export class Cat extends BaseEntity {
  @Column()
  name: string;

  @Column()
  age: number;

  @Column()
  breed: string;

  @ManyToOne(() => User, (user) => user.cats, {
    onDelete: 'SET NULL',
    eager: true,
  })
  // @JoinColumn({ name: 'ownerId' })
  owner: User;

  // @Column({ nullable: true })
  // ownerId: number;
}
