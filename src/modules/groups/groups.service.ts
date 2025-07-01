import { useRequestUser } from '@/common/context';
import { GroupMemberRolesEnum } from '@/common/decorators/group-member-roles.decorator';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { pick } from 'es-toolkit';
import { Repository, TreeRepository } from 'typeorm';
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

  private async setParentAndOrganization(group: Group, parentId: string) {
    const parentGroup = await this.groupTreeRepository.findOne({
      where: { id: parentId },
      relations: ['organizationGroup'],
    });

    if (!parentGroup) {
      throw new NotFoundException('Parent group not found');
    }

    group.parent = parentGroup;

    group.organizationGroup = parentGroup.isOrganization
      ? parentGroup
      : parentGroup.organizationGroup;
  }

  async isGroupLeaderOrCreator(groupId: string, userId: string) {
    const group = await this.groupTreeRepository.findOne({
      where: { id: groupId },
      relations: ['leader', 'createdBy'],
    });

    if (!group) {
      return false;
    }

    return group.leader.id === userId || group.createdBy.id === userId;
  }

  async createGroup(createGroupDto: CreateGroupDto) {
    const currentUser = useRequestUser();
    const values = pick(createGroupDto, [
      'name',
      'description',
      'isOrganization',
    ]);

    const newGroup = this.groupTreeRepository.create(values);

    // 设置父级和组织
    if (createGroupDto.parentId) {
      await this.setParentAndOrganization(newGroup, createGroupDto.parentId);
    } else if (!createGroupDto.isOrganization) {
      throw new BadRequestException('Parent group is required');
    }

    // 设置负责人: 疑问：添加负责人时，是否需要将负责人添加到成员中？又或者舍弃这个字段转而使用关系表添加一个 roles 枚举
    if (createGroupDto.leaderId) {
      const leader = await this.usersService.findOne(createGroupDto.leaderId);

      if (!leader) {
        throw new NotFoundException('Leader not found');
      }

      newGroup.leader = leader;
    }

    const savedGroup = await this.groupTreeRepository.save(newGroup);

    // 根据需要添加自己为成员
    if (createGroupDto.addSelfAsMember) {
      await this.addGroupMembers(savedGroup.id, [
        { userId: currentUser.id, role: GroupMemberRolesEnum.Admin },
      ]);
    }

    return savedGroup;
  }

  async updateGroup(groupId: string, { parentId, ...data }: UpdateGroupDto) {
    const group = await this.groupTreeRepository.findOne({
      where: { id: groupId },
      relations: ['organizationGroup', 'parent'],
    });

    if (!group) {
      throw new NotFoundException('Group not found');
    }

    if (parentId && parentId !== group.parent.id) {
      await this.setParentAndOrganization(group, parentId);
    }

    const updatedGroup = this.groupTreeRepository.merge(group, data);

    return this.groupTreeRepository.save(updatedGroup);
  }

  async addGroupMembers(
    groupId: string,
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

      const groupMember = this.groupMemberRepository.create({
        group: group,
        user: { id: user.userId },
        role: user.role,
      });

      return groupMember;
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

  async getGroupTreeByUser() {
    const user = useRequestUser();
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

    const organizationGroupIds = new Set<string>();

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
