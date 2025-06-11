import { RolesEnum } from '@/common/decorators/roles.decorator';
import { Cat } from '@/modules/cats/entities';
import { GroupMember } from '@/modules/groups/entities';
import { BaseEntity } from 'src/shared/entity/base.entity';
import { Column, Entity, OneToMany } from 'typeorm';

@Entity('users')
export class User extends BaseEntity {
  @Column({
    unique: true,
  })
  username: string;

  @Column({
    unique: true,
  })
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

  /**
   * 关联表
   */

  @OneToMany(() => Cat, (cat) => cat.owner)
  cats: Cat[];

  @OneToMany(() => GroupMember, (groupMember) => groupMember.user)
  groupMemberships: GroupMember[];
}
