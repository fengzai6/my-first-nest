import { User } from '@/modules/users/entities';
import { BaseEntity } from '@/shared/entity/base.entity';
import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  Tree,
  TreeChildren,
  TreeParent,
} from 'typeorm';
import { GroupMember } from './group-member.entity';

@Entity('groups')
@Tree('closure-table')
export class Group extends BaseEntity {
  @Column()
  name: string;

  @Column({
    nullable: true,
  })
  description: string;

  @Column({
    default: false,
  })
  @JoinColumn({ name: 'is_organization' })
  isOrganization: boolean;

  // @ManyToOne(() => Group, (group) => group.subGroups, { nullable: true })
  // @JoinColumn({ name: 'parent_group_id' })
  @TreeParent()
  parent: Group;

  // @OneToMany(() => Group, (group) => group.parentGroup)
  @TreeChildren()
  children: Group[];

  @ManyToOne(() => Group, { nullable: true })
  @JoinColumn({ name: 'organization_group_id' })
  organizationGroup: Group;

  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'leader_id' })
  leader: User;

  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'created_by_id' })
  createdBy: User;

  @OneToMany(() => GroupMember, (groupMember) => groupMember.group)
  members: GroupMember[];
}
