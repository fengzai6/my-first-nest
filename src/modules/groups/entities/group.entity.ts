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
  @TreeParent()
  // QUESTION: 不知道为什么，当我没有设置 JoinColum 的时候，默认查找的是 parentId，导致查询树结构报错
  // 但是我设置为 parent_id 的时候，migration 依旧是生成的 parent 字段
  // @JoinColumn({ name: 'parent_id' })
  @JoinColumn({ name: 'parent' })
  parent: Group;

  // @OneToMany(() => Group, (group) => group.parentGroup)
  @TreeChildren()
  children: Group[];

  @ManyToOne(() => Group, { nullable: true })
  @JoinColumn({ name: 'organization_group_id' })
  organizationGroup: Group;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'leader_id' })
  leader: User;

  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'created_by_id' })
  createdBy: User;

  @OneToMany(() => GroupMember, (groupMember) => groupMember.group)
  members: GroupMember[];
}
