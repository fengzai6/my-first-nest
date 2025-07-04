import { isRequestUser, useRequestUser } from '@/common/context';
import { GroupMemberRolesEnum } from '@/common/decorators/group-member-roles.decorator';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { pick } from 'es-toolkit';
import { Repository, TreeRepository } from 'typeorm';
import { AddGroupMembersDto } from './dto/create-group-members.dto';
import { CreateGroupServiceDto } from './dto/create-group.dto';
import { UpdateGroupMemberDto } from './dto/update-group-member.dto';
import { UpdateGroupDto } from './dto/update-group.dto';
import { Group, GroupMember } from './entities';
import { BaseResponse } from '@/common/response/base.response';

@Injectable()
export class GroupsService {
  constructor(
    @InjectRepository(Group)
    private readonly groupTreeRepository: TreeRepository<Group>,
    @InjectRepository(GroupMember)
    private readonly groupMemberRepository: Repository<GroupMember>,
  ) {}

  private async setParentAndOrganization(group: Group, parentId?: string) {
    if (parentId) {
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
  }

  async getGroupMemberRole(
    groupId: string,
    userId: string,
  ): Promise<GroupMemberRolesEnum | null> {
    let groupMemberRole: GroupMemberRolesEnum | null = null;

    const group = await this.groupTreeRepository.findOne({
      where: { id: groupId },
      relations: ['members', 'members.user'],
    });

    if (!group) {
      throw new NotFoundException('Group not found.');
    }

    // 检查当前组的成员是否为领导
    const membership = group.members.find(
      (member) => member.user.id === userId,
    );

    if (membership) {
      groupMemberRole = membership.role;
    }

    // 查询所有祖先组及其成员
    const ancestors = await this.groupTreeRepository.findAncestors(group, {
      relations: ['members', 'members.user'],
    });

    // 检查任何祖先组中是否有该用户作为领导
    const isSuperiorLeader = ancestors.some(
      (ancestor) =>
        ancestor.members.some(
          (member) =>
            member.user.id === userId &&
            member.role === GroupMemberRolesEnum.Leader,
        ) && ancestor.id !== groupId,
    );

    if (isSuperiorLeader) {
      groupMemberRole = GroupMemberRolesEnum.SuperiorLeader;
    }

    return groupMemberRole;
  }

  async createGroup(createGroupDto: CreateGroupServiceDto) {
    const currentUser = useRequestUser();

    const values = pick(createGroupDto, [
      'name',
      'description',
      'isOrganization',
    ]);

    const newGroup = this.groupTreeRepository.create(values);

    if (!createGroupDto.isOrganization && !createGroupDto.parentId) {
      throw new BadRequestException('Parent group is required');
    }

    // 设置父级和组织
    await this.setParentAndOrganization(newGroup, createGroupDto.parentId);

    const savedGroup = await this.groupTreeRepository.save(newGroup);

    // 根据需要添加自己为成员
    if (createGroupDto.addSelfToGroup) {
      await this.addGroupMembers(savedGroup.id, {
        members: [currentUser.id],
      });
    }

    return savedGroup;
  }

  async updateGroup(groupId: string, { parentId, ...data }: UpdateGroupDto) {
    const group = await this.groupTreeRepository.findOne({
      where: { id: groupId },
      relations: ['organizationGroup'],
    });

    if (!group) {
      throw new NotFoundException('Group not found');
    }

    await this.setParentAndOrganization(group, parentId);

    const updatedGroup = this.groupTreeRepository.merge(group, data);

    const savedGroup = await this.groupTreeRepository.save(updatedGroup);

    return savedGroup;
  }

  async getGroupTreesByUser() {
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
        relations: ['members', 'members.user'],
      });

      if (!organizationGroup) {
        continue;
      }

      const tree = await this.groupTreeRepository.findDescendantsTree(
        organizationGroup,
        {
          relations: ['members', 'members.user'],
        },
      );

      organizationTrees.push(tree);
    }

    return organizationTrees;
  }

  async getGroupTrees() {
    const groupTrees = await this.groupTreeRepository.findTrees({
      relations: ['members', 'members.user'],
    });

    return groupTrees;
  }

  async addGroupMembers(groupId: string, { members }: AddGroupMembersDto) {
    const group = await this.groupTreeRepository.findOne({
      where: { id: groupId },
      relations: ['members', 'members.user'],
    });

    if (!group) {
      throw new NotFoundException('Group not found');
    }

    // 检查是否有新的 leader 角色
    // const hasNewLeader = members.some(
    //   (member) => member.role === GroupMemberRolesEnum.Leader,
    // );

    // // 如果有新的 leader，需要检查并处理现有 leader
    // if (hasNewLeader) {
    //   const existingLeader = group.members.find(
    //     (member) => member.role === GroupMemberRolesEnum.Leader,
    //   );

    //   // 如果已经存在 leader，将其降级为 admin
    //   if (existingLeader) {
    //     existingLeader.role = GroupMemberRolesEnum.Member;
    //     await this.groupMemberRepository.save(existingLeader);
    //   }
    // }

    const newGroupMembers = members.map((userId) => {
      const existingMember = group.members.find(
        (member) => member.user.id === userId,
      );

      if (existingMember) {
        throw new BadRequestException(
          `User ${existingMember.user.username} already exists in group ${group.name}`,
        );
      }

      const groupMember = this.groupMemberRepository.create({
        group,
        user: { id: userId },
        role: GroupMemberRolesEnum.Member,
      });

      return groupMember;
    });

    const savedGroupMembers =
      await this.groupMemberRepository.save(newGroupMembers);

    return savedGroupMembers;
  }

  async updateGroupMember(
    groupId: string,
    userId: string,
    { role }: UpdateGroupMemberDto,
  ) {
    const groupMember = await this.groupMemberRepository.findOne({
      where: { group: { id: groupId }, user: { id: userId } },
    });

    if (!groupMember) {
      throw new NotFoundException('Group member not found');
    }

    // 如果要更新为 leader 角色，需要检查是否已存在 leader
    if (
      role === GroupMemberRolesEnum.Leader &&
      groupMember.role !== GroupMemberRolesEnum.Leader
    ) {
      const existingLeader = await this.groupMemberRepository.findOne({
        where: {
          group: { id: groupId },
          role: GroupMemberRolesEnum.Leader,
        },
      });

      if (existingLeader) {
        existingLeader.role = GroupMemberRolesEnum.Member;
        await this.groupMemberRepository.save(existingLeader);
      }
    }

    if (
      isRequestUser(userId) &&
      role === GroupMemberRolesEnum.Member &&
      groupMember.role === GroupMemberRolesEnum.Leader
    ) {
      throw new BadRequestException('Cannot update self role to member');
    }

    groupMember.role = role;

    return this.groupMemberRepository.save(groupMember);
  }

  async removeGroupMember(groupId: string, userId: string) {
    if (isRequestUser(userId)) {
      throw new BadRequestException('Cannot remove self');
    }

    const groupMember = await this.groupMemberRepository.findOne({
      where: {
        group: { id: groupId },
        user: { id: userId },
      },
    });

    if (!groupMember) {
      throw new NotFoundException('Group member not found');
    }

    if (groupMember.role === GroupMemberRolesEnum.Leader) {
      throw new BadRequestException('Cannot remove leader');
    }

    await this.groupMemberRepository.remove(groupMember);

    return new BaseResponse('Group member removed successfully');
  }
}
