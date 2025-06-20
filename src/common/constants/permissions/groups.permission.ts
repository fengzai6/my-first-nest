import { CreatePermissionDto } from '@/modules/permissions/dto/create-permission.dto';

export const GroupsPermissionCode = {
  GROUP_CREATE: 'group:create',
  GROUP_READ: 'group:read',
  GROUP_UPDATE: 'group:update',
  GROUP_DELETE: 'group:delete',
} as const;

export const GROUPS_PERMISSIONS: CreatePermissionDto[] = [
  {
    name: '创建组',
    code: GroupsPermissionCode.GROUP_CREATE,
  },
  {
    name: '读取组',
    code: GroupsPermissionCode.GROUP_READ,
  },
  {
    name: '更新组',
    code: GroupsPermissionCode.GROUP_UPDATE,
  },
  {
    name: '删除组',
    code: GroupsPermissionCode.GROUP_DELETE,
  },
];
