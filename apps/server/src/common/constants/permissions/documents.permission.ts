import { CreatePermissionDto } from '@/modules/permissions/dto/create-permission.dto';

export const DOCUMENTS_PERMISSION_CODE = {
  DOCUMENT_CREATE: 'document:create',
  DOCUMENT_READ: 'document:read',
  DOCUMENT_UPDATE: 'document:update',
  DOCUMENT_DELETE: 'document:delete',
} as const;

export const DOCUMENTS_PERMISSIONS: CreatePermissionDto[] = [
  { name: '创建资料文档', code: DOCUMENTS_PERMISSION_CODE.DOCUMENT_CREATE },
  { name: '读取资料文档', code: DOCUMENTS_PERMISSION_CODE.DOCUMENT_READ },
  { name: '更新资料文档', code: DOCUMENTS_PERMISSION_CODE.DOCUMENT_UPDATE },
  { name: '删除资料文档', code: DOCUMENTS_PERMISSION_CODE.DOCUMENT_DELETE },
];
