import { GroupsService } from '@/modules/groups/groups.service';
import { User } from '@/modules/users/entities';
import { UsersService } from '@/modules/users/users.service';
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import {
  GroupMemberRoles,
  GroupMemberRolesEnum,
  Permission,
  SpecialRolesEnum,
} from '../decorators';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private readonly groupsService: GroupsService,
    private readonly usersService: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermission = this.reflector.get(
      Permission,
      context.getHandler(),
    );

    if (!requiredPermission) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();

    const user = request.user;

    // 超级管理员拥有所有权限, 使用可选链模式避免报错
    if (user?.specialRoles?.includes(SpecialRolesEnum.SuperAdmin)) {
      return true;
    }

    if (!user) {
      return false;
    }

    const permissions = await this.usersService.getPermissions();

    const hasPermission = permissions.some(
      (permission) => permission.code === requiredPermission,
    );

    if (hasPermission) {
      return true;
    }

    const hasGroupPermission = await this.canActivateGroupPermission(
      context,
      user,
    );

    return hasGroupPermission;
  }

  /**
   * 实现群组权限的处理
   * 自身可以操作的，自身的信息，下级的创建和修改 isLeader
   * 自身组的角色只能通过上级修改 isSuperiorLeader
   * 目前只有领导的相关端点
   */
  async canActivateGroupPermission(
    context: ExecutionContext,
    user: User,
  ): Promise<boolean> {
    const requiredGroupRoles = this.reflector.get(
      GroupMemberRoles,
      context.getHandler(),
    );

    if (!requiredGroupRoles) {
      return true;
    }

    const request = context.switchToHttp().getRequest<
      Request<
        {
          groupId: string;
        },
        any,
        {
          parentId: string;
        }
      >
    >();

    const groupId = request.params.groupId || request.body.parentId;

    if (!groupId) {
      return true;
    }

    const groupMemberRole = await this.groupsService.getGroupMemberRole(
      groupId,
      user.id,
    );

    if (!groupMemberRole) {
      return false;
    }

    // 如果需要的角色中包含 leader，则 leader 或者 superiorLeader 可以通过
    if (requiredGroupRoles.includes(GroupMemberRolesEnum.Leader)) {
      return (
        groupMemberRole === GroupMemberRolesEnum.Leader ||
        groupMemberRole === GroupMemberRolesEnum.SuperiorLeader
      );
    }

    return requiredGroupRoles.includes(groupMemberRole);
  }
}
