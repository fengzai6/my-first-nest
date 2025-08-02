import type { IBase } from "./base";

export const SpecialRoles = {
  SuperAdmin: "super_admin",
  Developer: "developer",
} as const;

export type SpecialRoles = (typeof SpecialRoles)[keyof typeof SpecialRoles];

export interface IUserRole extends IBase {
  name: string;
  code: string;
  description?: string;
}

export interface IUserPermission extends IBase {
  name: string;
  code: string;
}

export interface IUser extends IBase {
  username: string;
  email?: string;
  nickname?: string;
  displayName: string;
  avatar?: string;
  specialRoles?: SpecialRoles[];
  roles?: IUserRole[];
  isActive: boolean;
}
