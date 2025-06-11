import { Reflector } from '@nestjs/core';

export enum GroupMemberRolesEnum {
  Admin = 'admin',
  Member = 'member',
}

export const GroupMemberRoles =
  Reflector.createDecorator<GroupMemberRolesEnum[]>();
