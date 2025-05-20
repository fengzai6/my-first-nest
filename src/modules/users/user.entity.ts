import { RolesEnum } from 'src/common/guards/roles.decorator';
import { BaseEntity } from 'src/shared/entity/base.entity';
import { Column, Entity, OneToMany } from 'typeorm';
import { Cat } from '../cats/cat.entity';

@Entity()
export class User extends BaseEntity {
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
