import { Reflector } from '@nestjs/core';

export enum GroupMemberRolesEnum {
  // 非使用，仅用于权限设置和判断
  SuperiorLeader = 'superior_leader',
  // 可用枚举
  Leader = 'leader',
  Member = 'member',
}

export const GroupMemberRoles =
  Reflector.createDecorator<GroupMemberRolesEnum[]>();
