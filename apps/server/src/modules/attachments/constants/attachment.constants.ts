import { resolve } from 'path';

export const ATTACHMENT_VISIBILITY = {
  PRIVATE: 'private',
  PUBLIC: 'public',
} as const;

export type AttachmentVisibility =
  (typeof ATTACHMENT_VISIBILITY)[keyof typeof ATTACHMENT_VISIBILITY];

export const ATTACHMENT_STORAGE_PROVIDER = {
  LOCAL: 'local',
} as const;

export type AttachmentStorageProvider =
  (typeof ATTACHMENT_STORAGE_PROVIDER)[keyof typeof ATTACHMENT_STORAGE_PROVIDER];

export const ATTACHMENT_BIZ_TYPE = {
  USER_AVATAR: 'user-avatar',
  DOCUMENT: 'document',
} as const;

export const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024;
export const MAX_ATTACHMENT_COUNT = 5;
export const MAX_AVATAR_SIZE = 2 * 1024 * 1024;

export const ATTACHMENT_UPLOAD_TEMP_DIR = resolve(
  process.cwd(),
  process.env.UPLOAD_DIR || 'uploads',
  'tmp',
);

export const ATTACHMENT_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/zip',
  'application/x-7z-compressed',
  'application/x-rar-compressed',
] as const;

export const AVATAR_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;
