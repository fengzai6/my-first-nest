import type {
  IAddGroupMembersDto,
  ICreateGroupDto,
  ICreateRootOrgGroupDto,
  IUpdateGroupDto,
  IUpdateGroupMemberDto,
} from "../dtos/group";
import type { IGroup } from "../types/group";
import http from "./http";

export const CreateGroup = async (data: ICreateGroupDto) => {
  const res = await http.post<IGroup>("/groups", data);
  return res.data;
};

/**
 * 管理员创建根组织群组
 */
export const CreateRootOrgGroup = async (data: ICreateRootOrgGroupDto) => {
  const res = await http.post<IGroup>("/groups/rootOrg", data);
  return res.data;
};

export const UpdateGroup = async (groupId: string, data: IUpdateGroupDto) => {
  const res = await http.patch<IGroup>(`/groups/${groupId}`, data);
  return res.data;
};

/**
 * 获取当前用户所在群组树
 */
export const GetGroupTreesByUser = async () => {
  const res = await http.get<IGroup[]>("/groups/treesByUser");
  return res.data;
};

/**
 * 获取所有群组树
 */
export const GetGroupTrees = async () => {
  const res = await http.get<IGroup[]>("/groups/trees");
  return res.data;
};

export const AddGroupMembers = async (
  groupId: string,
  data: IAddGroupMembersDto,
) => {
  const res = await http.post(`/groups/${groupId}/members`, data);
  return res.data;
};

export const UpdateGroupMember = async (
  groupId: string,
  userId: string,
  data: IUpdateGroupMemberDto,
) => {
  const res = await http.patch(`/groups/${groupId}/members/${userId}`, data);
  return res.data;
};

export const RemoveGroupMember = async (groupId: string, userId: string) => {
  const res = await http.delete(`/groups/${groupId}/members/${userId}`);
  return res.data;
};
