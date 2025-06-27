import { SpecialRolesEnum } from '@/common/decorators/special-roles.decorator';
import { Cat } from '@/modules/cats/entities';
import { GroupMember } from '@/modules/groups/entities';
import { Role } from '@/modules/roles/entities';
import { BaseEntity } from '@/shared/entity/base.entity';
import { Exclude } from 'class-transformer';
import { Column, Entity, JoinTable, ManyToMany, OneToMany } from 'typeorm';

@Entity('users')
export class User extends BaseEntity {
  @Column({
    unique: true,
  })
  username: string;

  @Column({
    unique: true,
    nullable: true,
  })
  email: string;

  @Exclude()
  @Column()
  password: string;

  @Column({
    nullable: true,
    type: 'simple-array',
  })
  specialRoles: SpecialRolesEnum[];

  @Column({
    default: true,
  })
  isActive: boolean;

  /**
   * 关联
   */
  @ManyToMany(() => Role, (role) => role.users)
  @JoinTable({
    name: 'user_roles',
    joinColumn: {
      name: 'user_id',
      referencedColumnName: 'id',
    },
    inverseJoinColumn: {
      name: 'role_id',
      referencedColumnName: 'id',
    },
  })
  roles: Role[];

  @OneToMany(() => Cat, (cat) => cat.owner)
  cats: Cat[];

  @OneToMany(() => GroupMember, (groupMember) => groupMember.user)
  groupMemberships: GroupMember[];
}
