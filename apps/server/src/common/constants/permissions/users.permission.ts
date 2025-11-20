import { CreatePermissionDto } from '@/modules/permissions/dto/create-permission.dto';

export const UsersPermissionCode = {
  USER_CREATE: 'user:create',
  USER_READ: 'user:read',
  USER_UPDATE: 'user:update',
  USER_DELETE: 'user:delete',
} as const;

export const USERS_PERMISSIONS: CreatePermissionDto[] = [
  {
    name: '创建用户',
    code: UsersPermissionCode.USER_CREATE,
  },
  {
    name: '读取用户',
    code: UsersPermissionCode.USER_READ,
  },
  {
    name: '更新用户',
    code: UsersPermissionCode.USER_UPDATE,
  },
  {
    name: '删除用户',
    code: UsersPermissionCode.USER_DELETE,
  },
];
