import type { IBase } from "./base";
import type { ICat } from "./cat";

export const SpecialRoles = {
  SuperAdmin: "super_admin",
  Developer: "developer",
} as const;

export type SpecialRoles = (typeof SpecialRoles)[keyof typeof SpecialRoles];

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
  specialRoles: SpecialRoles[];
  roles: IUserRole[];
  cats?: ICat[];
}
