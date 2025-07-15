export interface ICreateRoleDto {
  name: string;
  code: string;
  description?: string;
  /** 权限code列表 */
  permissions: string[];
}

export interface IUpdateRoleDto {
  name?: string;
  description?: string;
  /** 权限code列表 */
  permissions?: string[];
}
