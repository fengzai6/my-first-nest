import { RolesEnum } from '@/common/decorators/roles.decorator';
import { BaseEntity } from 'src/shared/entity/base.entity';
import { Column, Entity, OneToMany } from 'typeorm';
import { Cat } from '../cats/cat.entity';

@Entity()
export class User extends BaseEntity {
  @Column()
  username: string;

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
  roles: RolesEnum[];

  @OneToMany(() => Cat, (cat) => cat.owner)
  cats: Cat[];
}
