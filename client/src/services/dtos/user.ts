import type { SpecialRoles } from "../types/user";

export interface ICreateUserDto {
  username: string;
  email: string;
  password: string;
  roles?: string[];
}

export interface IUpdateUserDto {
  username?: string;
  email?: string;
  isActive?: boolean;
}

export interface IUpdateUserRolesDto {
  roles: string[];
}

export interface IUpdateUserSpecialRolesDto {
  roles: SpecialRoles[];
}

export interface IUpdatePasswordDto {
  oldPassword: string;
  newPassword: string;
}

export interface IUpdatePasswordByAdminDto {
  newPassword: string;
}
