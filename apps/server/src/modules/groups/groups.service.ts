import { isRequestUser, useRequestUser } from '@/common/context';
import { GroupMemberRolesEnum } from '@/common/decorators/group-member-roles.decorator';
import { ErrorException } from '@/common/exceptions/error.exception';
import { GroupExceptionCode } from '@/common/exceptions/group.exception';
import { BaseResponse } from '@/common/response/base.response';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { pick } from 'es-toolkit';
import { In, Repository, TreeRepository } from 'typeorm';
import { AddGroupMembersDto } from './dto/create-group-members.dto';
import { CreateGroupServiceDto } from './dto/create-group.dto';
import { UpdateGroupMemberDto } from './dto/update-group-member.dto';
import { UpdateGroupDto } from './dto/update-group.dto';
import { Group, GroupMember } from './entities';

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
        throw new ErrorException(GroupExceptionCode.PARENT_GROUP_NOT_FOUND);
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
    const group = await this.groupTreeRepository.findOne({
      where: { id: groupId },
    });

    if (!group) {
      throw new ErrorException(GroupExceptionCode.GROUP_NOT_FOUND);
    }

    // 直接查询当前组内该用户的角色
    const membership = await this.groupMemberRepository.findOne({
      where: { group: { id: groupId }, user: { id: userId } },
    });

    if (!membership) {
      return null;
    }

    // 查询祖先组中该用户是否为 Leader
    const ancestors = await this.groupTreeRepository.findAncestors(group);

    const ancestorIds = ancestors
      .filter((a) => a.id !== groupId)
      .map((a) => a.id);

    if (ancestorIds.length > 0) {
      const superiorLeader = await this.groupMemberRepository.findOne({
        where: {
          group: { id: In(ancestorIds) },
          user: { id: userId },
          role: GroupMemberRolesEnum.Leader,
        },
      });

      if (superiorLeader) {
        return GroupMemberRolesEnum.SuperiorLeader;
      }
    }

    return membership.role;
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
      throw new ErrorException(GroupExceptionCode.PARENT_GROUP_IS_REQUIRED);
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
      throw new ErrorException(GroupExceptionCode.GROUP_NOT_FOUND);
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

    const organizationGroups = await this.groupTreeRepository.find({
      where: { id: In([...organizationGroupIds]) },
      relations: ['members', 'members.user'],
    });

    const organizationTrees = await Promise.all(
      organizationGroups.map((group) =>
        this.groupTreeRepository.findDescendantsTree(group, {
          relations: ['members', 'members.user'],
        }),
      ),
    );

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
    });

    if (!group) {
      throw new ErrorException(GroupExceptionCode.GROUP_NOT_FOUND);
    }

    const existingMembers = await this.groupMemberRepository.find({
      where: {
        group: { id: groupId },
        user: { id: In(members) },
      },
    });

    if (existingMembers.length > 0) {
      throw new ErrorException(GroupExceptionCode.USER_ALREADY_IN_GROUP);
    }

    const newGroupMembers = members.map((userId) =>
      this.groupMemberRepository.create({
        group,
        user: { id: userId },
        role: GroupMemberRolesEnum.Member,
      }),
    );

    return this.groupMemberRepository.save(newGroupMembers);
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
      throw new ErrorException(GroupExceptionCode.GROUP_MEMBER_NOT_FOUND);
    }

    if (
      isRequestUser(userId) &&
      role === GroupMemberRolesEnum.Member &&
      groupMember.role === GroupMemberRolesEnum.Leader
    ) {
      throw new ErrorException(
        GroupExceptionCode.CANNOT_UPDATE_SELF_ROLE_TO_MEMBER,
      );
    }

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

    groupMember.role = role;

    return this.groupMemberRepository.save(groupMember);
  }

  async removeGroupMember(groupId: string, userId: string) {
    if (isRequestUser(userId)) {
      throw new ErrorException(GroupExceptionCode.CANNOT_REMOVE_SELF);
    }

    const groupMember = await this.groupMemberRepository.findOne({
      where: {
        group: { id: groupId },
        user: { id: userId },
      },
    });

    if (!groupMember) {
      throw new ErrorException(GroupExceptionCode.GROUP_MEMBER_NOT_FOUND);
    }

    if (groupMember.role === GroupMemberRolesEnum.Leader) {
      throw new ErrorException(GroupExceptionCode.CANNOT_REMOVE_LEADER);
    }

    await this.groupMemberRepository.remove(groupMember);

    return new BaseResponse('Group member removed successfully');
  }
}
