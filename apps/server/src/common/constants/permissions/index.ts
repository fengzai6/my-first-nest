import {
  ATTACHMENTS_PERMISSIONS,
  AttachmentsPermissionCode,
} from './attachments.permission';
import { CATS_PERMISSIONS, CatsPermissionCode } from './cats.permission';
import {
  DOCUMENTS_PERMISSIONS,
  DOCUMENTS_PERMISSION_CODE,
} from './documents.permission';
import { GROUPS_PERMISSIONS, GroupsPermissionCode } from './groups.permission';
import {
  PERMISSIONS_PERMISSIONS,
  PermissionsPermissionCode,
} from './permissions.permission';
import { ROLES_PERMISSIONS, RolesPermissionCode } from './roles.permission';
import { USERS_PERMISSIONS, UsersPermissionCode } from './users.permission';

export const PermissionCode = {
  ...UsersPermissionCode,
  ...CatsPermissionCode,
  ...RolesPermissionCode,
  ...GroupsPermissionCode,
  ...PermissionsPermissionCode,
  ...AttachmentsPermissionCode,
  ...DOCUMENTS_PERMISSION_CODE,
} as const;

export type PermissionCodeType =
  (typeof PermissionCode)[keyof typeof PermissionCode];

export const PERMISSIONS = [
  ...USERS_PERMISSIONS,
  ...CATS_PERMISSIONS,
  ...ROLES_PERMISSIONS,
  ...GROUPS_PERMISSIONS,
  ...PERMISSIONS_PERMISSIONS,
  ...DOCUMENTS_PERMISSIONS,
  ...ATTACHMENTS_PERMISSIONS,
];
