import { CreatePermissionDto } from '@/modules/permissions/dto/create-permission.dto';

export const AttachmentsPermissionCode = {
  ATTACHMENT_READ: 'attachment:read',
  ATTACHMENT_MANAGE: 'attachment:manage',
} as const;

export const ATTACHMENTS_PERMISSIONS: CreatePermissionDto[] = [
  {
    name: '读取附件管理信息',
    code: AttachmentsPermissionCode.ATTACHMENT_READ,
  },
  {
    name: '管理附件',
    code: AttachmentsPermissionCode.ATTACHMENT_MANAGE,
  },
];
