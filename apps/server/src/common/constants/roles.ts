import { CreatePermissionDto } from '@/modules/permissions/dto/create-permission.dto';
import { PERMISSIONS } from './permissions';
import { USERS_PERMISSIONS } from './permissions/users.permission';

interface RoleDefinition {
  name: string;
  description: string;
  code: string;
  permissions: CreatePermissionDto[];
}

export const RoleCode = {
  ADMIN: 'admin',
  USER: 'user',
} as const;

export const DEFAULT_ROLES: RoleDefinition[] = [
  {
    name: 'admin',
    description: '管理员',
    code: RoleCode.ADMIN,
    permissions: PERMISSIONS,
  },
  {
    name: 'user',
    description: '用户',
    code: RoleCode.USER,
    permissions: [...USERS_PERMISSIONS],
  },
];
