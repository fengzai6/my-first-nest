import { SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

export const GROUP_ROLES_META_KEY = 'GROUP_ROLES_META_KEY';
export const GROUP_LEADER_OR_CREATOR_KEY = 'GROUP_LEADER_OR_CREATOR_KEY';

export enum GroupMemberRolesEnum {
  Admin = 'admin',
  Member = 'member',
}

export const GroupLeaderOrCreator = () =>
  SetMetadata(GROUP_LEADER_OR_CREATOR_KEY, true);

export const GroupMemberRoles =
  Reflector.createDecorator<GroupMemberRolesEnum[]>();
