import { PermissionCodeType } from '@/common/constants/permissions';
import { Role } from '@/modules/roles/entities/role.entity';
import { BaseEntity } from '@/shared/entity/base.entity';
import { Column, Entity, ManyToMany } from 'typeorm';

@Entity('permissions')
export class Permission extends BaseEntity {
  @Column({
    unique: true,
  })
  name: string;

  @Column({
    unique: true,
  })
  code: PermissionCodeType;

  @Column({ nullable: true })
  description: string;

  @ManyToMany(() => Role, (role) => role.permissions)
  roles: Role[];
}
