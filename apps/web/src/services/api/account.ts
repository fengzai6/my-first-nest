import type { IUpdatePasswordDto, IUpdateUserDto } from "../dtos/user";
import type { IUser, IUserPermission } from "../types/user";
import http from "./http";

/**
 * 获取当前用户信息
 */
export const GetProfile = async () => {
  const res = await http.get<IUser>("/account/profile");

  return res.data;
};

/**
 * 修改当前用户信息
 */
export const UpdateProfile = async (data: IUpdateUserDto) => {
  const res = await http.patch<IUser>("/account/profile", data);

  return res.data;
};

/**
 * 修改当前用户密码
 */
export const UpdatePassword = async (data: IUpdatePasswordDto) => {
  const res = await http.post("/account/password", data);

  return res.data;
};

/**
 * 获取当前用户权限
 */
export const GetUserPermissions = async () => {
  const res = await http.get<IUserPermission[]>("/account/permissions");

  return res.data;
};
