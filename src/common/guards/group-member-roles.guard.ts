import { Group, GroupMember } from '@/modules/groups/entities';
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Request } from 'express';
import { Repository } from 'typeorm';
import {
  GROUP_LEADER_OR_CREATOR_KEY,
  GroupMemberRolesEnum,
} from '../decorators/group-member-roles.decorator';
import { SpecialRolesEnum } from '../decorators/special-roles.decorator';

// ai 生成还没改动
@Injectable()
export class GroupMemberRolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @InjectRepository(Group)
    private readonly groupRepository: Repository<Group>,
    @InjectRepository(GroupMember)
    private readonly groupMemberRepository: Repository<GroupMember>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request: Request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      return false;
    }

    // SuperAdmin has all permissions
    if (user.specialRoles?.includes(SpecialRolesEnum.SuperAdmin)) {
      return true;
    }

    const isLeaderOrCreatorCheck = this.reflector.get<boolean>(
      GROUP_LEADER_OR_CREATOR_KEY,
      context.getHandler(),
    );

    // If the decorator is not applied, don't block
    if (!isLeaderOrCreatorCheck) {
      return true;
    }

    const groupId = request.params.groupId;
    if (!groupId) {
      // This guard should only be used on routes with a groupId param
      throw new Error(
        'GroupMemberRolesGuard requires a "groupId" path parameter.',
      );
    }

    const group = await this.groupRepository.findOne({
      where: { id: groupId },
      relations: ['leader', 'createdBy'],
    });

    if (!group) {
      throw new NotFoundException('Group not found.');
    }

    // Check if the user is the leader or the creator of the group
    const isLeader = group.leader?.id === user.id;
    const isCreator = group.createdBy?.id === user.id;

    if (isLeader || isCreator) {
      return true;
    }

    // Check if the user is an admin member of the group
    const membership = await this.groupMemberRepository.findOne({
      where: {
        group: { id: groupId },
        user: { id: user.id },
      },
    });

    if (membership?.role === GroupMemberRolesEnum.Admin) {
      return true;
    }

    throw new ForbiddenException(
      'You do not have permission to perform this action.',
    );
  }
}
