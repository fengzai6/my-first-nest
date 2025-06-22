import { CreatePermissionDto } from '@/modules/permissions/dto/create-permission.dto';

export const PermissionsPermissionCode = {
  PERMISSION_CREATE: 'permission:create',
  PERMISSION_READ: 'permission:read',
  PERMISSION_UPDATE: 'permission:update',
  // 权限不应该被删除，因为权限是与程序一起发布的
  // PERMISSION_DELETE: 'permission:delete',
} as const;

export const PERMISSIONS_PERMISSIONS: CreatePermissionDto[] = [
  {
    name: '创建权限',
    code: PermissionsPermissionCode.PERMISSION_CREATE,
  },
  {
    name: '读取权限',
    code: PermissionsPermissionCode.PERMISSION_READ,
  },
  {
    name: '更新权限',
    code: PermissionsPermissionCode.PERMISSION_UPDATE,
  },
];
