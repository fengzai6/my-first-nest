import { GroupMemberRolesEnum } from '@/common/decorators/group-member-roles.decorator';
import { User } from '@/modules/users/entities';
import { BaseEntity } from '@/shared/entity/base.entity';
import { Column, Entity, JoinColumn, ManyToOne, Unique } from 'typeorm';
import { Group } from './group.entity';

@Entity('group_members')
@Unique(['group', 'user'])
export class GroupMember extends BaseEntity {
  @ManyToOne(() => Group, (group) => group.members)
  @JoinColumn({ name: 'group_id' })
  group: Group;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({
    type: 'enum',
    enum: GroupMemberRolesEnum,
    default: GroupMemberRolesEnum.Member,
  })
  role: GroupMemberRolesEnum;
}
