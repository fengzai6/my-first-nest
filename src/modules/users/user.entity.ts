import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Cat } from '../cats/cat.entity';
import { RolesEnum } from 'src/common/guards/roles.decorator';

@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column()
  email: string;

  @Column({
    select: false,
  })
  password: string;

  @Column({
    nullable: true,
    type: 'simple-array',
  })
  role: RolesEnum[];

  @OneToMany(() => Cat, (cat) => cat.owner)
  cats: Cat[];
}
