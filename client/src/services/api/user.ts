import type {
  ICreateUserDto,
  IUpdatePasswordByAdminDto,
  IUpdateUserDto,
  IUpdateUserRolesDto,
  IUpdateUserSpecialRolesDto,
} from "../dtos/user";
import type { IUser } from "../types/user";
import http from "./http";

/**
 * 创建用户
 */
export const CreateUser = async (data: ICreateUserDto) => {
  const res = await http.post<IUser>("/users", data);

  return res.data;
};

/**
 * 获取所有用户
 */
export const GetUsers = async () => {
  const res = await http.get<IUser[]>("/users");

  return res.data;
};

/**
 * 获取用户
 */
export const GetUser = async (id: string) => {
  const res = await http.get<IUser>(`/users/${id}`);

  return res.data;
};

/**
 * 更新用户
 */
export const UpdateUser = async (id: string, data: IUpdateUserDto) => {
  const res = await http.patch<IUser>(`/users/${id}`, data);

  return res.data;
};

/**
 * 更新用户特殊角色
 */
export const UpdateUserSpecialRoles = async (
  id: string,
  data: IUpdateUserSpecialRolesDto,
) => {
  const res = await http.patch<IUser>(`/users/${id}/special-roles`, data);

  return res.data;
};

/**
 * 更新用户角色
 */
export const UpdateUserRoles = async (
  id: string,
  data: IUpdateUserRolesDto,
) => {
  const res = await http.patch<IUser>(`/users/${id}/roles`, data);

  return res.data;
};

/**
 * 更新用户密码
 */
export const UpdateUserPasswordByAdmin = async (
  id: string,
  data: IUpdatePasswordByAdminDto,
) => {
  const res = await http.patch(`/users/${id}/password`, data);

  return res.data;
};

/**
 * 删除用户
 */
export const RemoveUser = async (id: string) => {
  const res = await http.delete(`/users/${id}`);

  return res.data;
};
