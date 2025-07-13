import type { IBase } from "./base";

export const SpecialRoles = {
  SuperAdmin: "super_admin",
  Developer: "developer",
} as const;

export type SpecialRolesType = (typeof SpecialRoles)[keyof typeof SpecialRoles];

export interface IUserRole extends IBase {
  name: string;
  description?: string;
  code: string;
}

export interface IUserPermission extends IBase {
  name: string;
  code: string;
}

export interface IUser extends IBase {
  username: string;
  email: string;
  isActive: boolean;
  specialRoles: SpecialRolesType[];
  roles: IUserRole[];
}
