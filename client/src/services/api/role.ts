import type { ICreateRoleDto, IUpdateRoleDto } from "../dtos/role";
import type { IRole } from "../types/role";
import http from "./http";

/**
 * 获取所有角色
 */
export const GetRoles = async () => {
  const res = await http.get<IRole[]>("/roles");

  return res.data;
};

/**
 * 获取单个角色
 */
export const GetRole = async (id: string) => {
  const res = await http.get<IRole>(`/roles/${id}`);

  return res.data;
};

/**
 * 创建角色
 */
export const CreateRole = async (data: ICreateRoleDto) => {
  const res = await http.post<IRole>("/roles", data);

  return res.data;
};

/**
 * 更新角色
 */
export const UpdateRole = async (id: string, data: IUpdateRoleDto) => {
  const res = await http.patch<IRole>(`/roles/${id}`, data);

  return res.data;
};

/**
 * 删除角色
 */
export const DeleteRole = async (id: string) => {
  await http.delete(`/roles/${id}`);
};
