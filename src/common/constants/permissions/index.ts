import { CATS_PERMISSIONS, CatsPermissionCode } from './cats.permission';
import { ROLES_PERMISSIONS, RolesPermissionCode } from './roles.permission';
import { USERS_PERMISSIONS, UsersPermissionCode } from './users.permission';

export const PermissionCode = {
  ...UsersPermissionCode,
  ...CatsPermissionCode,
  ...RolesPermissionCode,
} as const;

export type PermissionCodeType =
  (typeof PermissionCode)[keyof typeof PermissionCode];

export const PERMISSIONS = [
  ...USERS_PERMISSIONS,
  ...CATS_PERMISSIONS,
  ...ROLES_PERMISSIONS,
];
