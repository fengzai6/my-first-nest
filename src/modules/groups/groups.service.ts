import { GroupMemberRolesEnum } from '@/common/decorators/group-member-roles.decorator';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { pick } from 'es-toolkit';
import { Repository, TreeRepository } from 'typeorm';
import { User } from '../users/entities';
import { UsersService } from '../users/users.service';
import { AddGroupMembersDto } from './dto/create-group-members.dto';
import { CreateGroupDto } from './dto/create-group.dto';
import { RemoveGroupMemberDto } from './dto/remove-group-member.dto';
import { UpdateGroupDto } from './dto/update-group.dto';
import { Group, GroupMember } from './entities';

@Injectable()
export class GroupsService {
  constructor(
    @InjectRepository(Group)
    private readonly groupTreeRepository: TreeRepository<Group>,
    @InjectRepository(GroupMember)
    private readonly groupMemberRepository: Repository<GroupMember>,
    private readonly usersService: UsersService,
  ) {}

  async isGroupLeaderOrCreator(groupId: number, userId: number) {
    const group = await this.groupTreeRepository.findOne({
      where: { id: groupId },
      relations: ['leader', 'createdBy'],
    });

    if (!group) {
      return false;
    }

    return group.leader.id === userId || group.createdBy.id === userId;
  }

  async createGroup(createGroupDto: CreateGroupDto, currentUser: User) {
    const values = pick(createGroupDto, [
      'name',
      'description',
      'isOrganization',
    ]);

    const newGroup = this.groupTreeRepository.create(values);

    // 设置父级和组织
    if (createGroupDto.parentId) {
      const parentGroup = await this.groupTreeRepository.findOne({
        where: { id: createGroupDto.parentId },
        relations: ['organizationGroup'],
      });

      if (!parentGroup) {
        throw new NotFoundException('Parent group not found');
      }

      newGroup.parent = parentGroup;

      newGroup.organizationGroup = parentGroup.isOrganization
        ? parentGroup
        : parentGroup.organizationGroup;
    } else if (!createGroupDto.isOrganization) {
      throw new BadRequestException('Parent group is required');
    }

    // 设置负责人
    if (createGroupDto.leaderId) {
      const leader = await this.usersService.findOne(createGroupDto.leaderId);

      if (!leader) {
        throw new NotFoundException('Leader not found');
      }

      newGroup.leader = leader;
    }

    // 设置创建者
    newGroup.createdBy = currentUser;

    console.log('createGroup: newGroup', newGroup);

    const savedGroup = await this.groupTreeRepository.save(newGroup);

    // 根据需要添加自己为成员
    if (createGroupDto.addSelfAsMember) {
      await this.addGroupMembers(savedGroup.id, [
        { userId: currentUser.id, role: GroupMemberRolesEnum.Admin },
      ]);
    }

    delete savedGroup.createdBy;

    return savedGroup;
  }

  async updateGroup(updateGroupDto: UpdateGroupDto) {
    const { groupId, ...rest } = updateGroupDto;
    // 更新 group，当更换 父级时，需要更新 organizationGroup
  }

  async addGroupMembers(
    groupId: number,
    addGroupMembersDto: AddGroupMembersDto,
  ) {
    const group = await this.groupTreeRepository.findOne({
      where: { id: groupId },
      relations: ['members', 'members.user'],
    });

    if (!group) {
      throw new NotFoundException('Group not found');
    }

    const newGroupMembers = addGroupMembersDto.map((user) => {
      const existingMember = group.members.find(
        (member) => member.user.id === user.userId,
      );

      if (existingMember) {
        return existingMember;
      }

      return {
        group: group,
        user: { id: user.userId },
        role: user.role,
      };
    });

    const savedGroupMembers =
      await this.groupMemberRepository.save(newGroupMembers);

    return savedGroupMembers;
  }

  async removeGroupMember(removeGroupMemberDto: RemoveGroupMemberDto) {
    const { groupId, userId } = removeGroupMemberDto;

    const isLeader = await this.groupTreeRepository.findOne({
      where: { id: groupId, leader: { id: userId } },
    });

    if (isLeader) {
      throw new BadRequestException('Cannot remove leader');
    }

    const groupMember = await this.groupMemberRepository.findOne({
      where: { group: { id: groupId }, user: { id: userId } },
    });

    if (!groupMember) {
      throw new NotFoundException('Group member not found');
    }

    await this.groupMemberRepository.remove(groupMember);

    return {
      message: 'Group member removed successfully',
    };
  }

  async getGroupTreeByUser(user: User) {
    const userGroups = await this.groupTreeRepository.find({
      where: {
        members: {
          user: { id: user.id },
        },
      },
      relations: {
        organizationGroup: true,
      },
    });

    if (userGroups.length === 0) {
      return [];
    }

    const organizationGroupIds = new Set<number>();

    for (const group of userGroups) {
      if (group.isOrganization) {
        organizationGroupIds.add(group.id);
      } else if (group.organizationGroup) {
        organizationGroupIds.add(group.organizationGroup.id);
      }
    }

    const organizationTrees = [];

    for (const organizationGroupId of organizationGroupIds) {
      const organizationGroup = await this.groupTreeRepository.findOne({
        where: { id: organizationGroupId },
        relations: ['leader', 'members', 'members.user'],
      });

      if (!organizationGroup) {
        continue;
      }

      const tree = await this.groupTreeRepository.findDescendantsTree(
        organizationGroup,
        {
          relations: ['leader', 'members', 'members.user'],
        },
      );

      organizationTrees.push(tree);
    }

    return organizationTrees;
  }
}
