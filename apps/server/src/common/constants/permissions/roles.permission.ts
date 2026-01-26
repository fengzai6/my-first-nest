import { CreatePermissionDto } from '@/modules/permissions/dto/create-permission.dto';

export const RolesPermissionCode = {
  ROLE_CREATE: 'role:create',
  ROLE_READ: 'role:read',
  ROLE_UPDATE: 'role:update',
  ROLE_DELETE: 'role:delete',
} as const;

export const ROLES_PERMISSIONS: CreatePermissionDto[] = [
  {
    name: '创建角色',
    code: RolesPermissionCode.ROLE_CREATE,
  },
  {
    name: '读取角色',
    code: RolesPermissionCode.ROLE_READ,
  },
  {
    name: '更新角色',
    code: RolesPermissionCode.ROLE_UPDATE,
  },
  {
    name: '删除角色',
    code: RolesPermissionCode.ROLE_DELETE,
  },
];
