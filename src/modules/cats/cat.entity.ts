import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../users/user.entity';

@Entity()
export class Cat {
  @PrimaryGeneratedColumn()
  id: number;

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
