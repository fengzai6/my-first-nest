import type { IUpdatePermissionDto } from "../dtos/permission";
import type { IPermission } from "../types/permission";
import http from "./http";

/**
 * 获取所有权限
 */
export const GetPermissions = async () => {
  const res = await http.get<IPermission[]>("/permissions");

  return res.data;
};

/**
 * 获取单个权限
 */
export const GetPermission = async (id: string) => {
  const res = await http.get<IPermission>(`/permissions/${id}`);

  return res.data;
};

/**
 * 更新权限
 */
export const UpdatePermission = async (
  id: string,
  data: IUpdatePermissionDto,
) => {
  const res = await http.patch<IPermission>(`/permissions/${id}`, data);

  return res.data;
};
