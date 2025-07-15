import type { IBase } from "./base";
import type { IUser } from "./user";

export const GroupMemberRoles = {
  Leader: "leader",
  Member: "member",
} as const;

export type GroupMemberRoles =
  (typeof GroupMemberRoles)[keyof typeof GroupMemberRoles];

export interface IGroupMember extends IBase {
  user: IUser;
  role: GroupMemberRoles;
  group: IGroup;
}

export interface IGroup extends IBase {
  name: string;
  description?: string;
  isOrganization: boolean;
  parent?: IGroup;
  children: IGroup[];
  members: IGroupMember[];
}
