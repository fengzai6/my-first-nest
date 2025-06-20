import { CreatePermissionDto } from '@/modules/permissions/dto/create-permission.dto';

export const CatsPermissionCode = {
  CAT_CREATE: 'cat:create',
  CAT_READ: 'cat:read',
  CAT_UPDATE: 'cat:update',
  CAT_DELETE: 'cat:delete',
} as const;

export const CATS_PERMISSIONS: CreatePermissionDto[] = [
  {
    name: '创建猫咪',
    code: CatsPermissionCode.CAT_CREATE,
  },
  {
    name: '读取猫咪',
    code: CatsPermissionCode.CAT_READ,
  },
  {
    name: '更新猫咪',
    code: CatsPermissionCode.CAT_UPDATE,
  },
  {
    name: '删除猫咪',
    code: CatsPermissionCode.CAT_DELETE,
  },
];
