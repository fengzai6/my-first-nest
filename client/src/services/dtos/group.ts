import type { GroupMemberRoles } from "../types/group";

export interface ICreateGroupDto {
  name: string;
  parentId: string;
  description?: string;
  isOrganization?: boolean;
  addSelfToGroup?: boolean;
}

export interface ICreateRootOrgGroupDto {
  name: string;
  description?: string;
  addSelfToGroup?: boolean;
}

export interface IUpdateGroupDto {
  name?: string;
  parentId?: string;
  description?: string;
}

export interface IAddGroupMembersDto {
  /** 用户ID列表 */
  members: string[];
}

export interface IUpdateGroupMemberDto {
  role: GroupMemberRoles;
}
