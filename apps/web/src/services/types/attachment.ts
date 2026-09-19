import type { IBase } from "./base";

export const ATTACHMENT_VISIBILITY = {
  PRIVATE: "private",
  PUBLIC: "public",
} as const;

export type AttachmentVisibility =
  (typeof ATTACHMENT_VISIBILITY)[keyof typeof ATTACHMENT_VISIBILITY];

export interface IAttachment extends IBase {
  originalName: string;
  mimeType: string;
  size: number;
  visibility: AttachmentVisibility;
  storageProvider: string;
  /** 业务模块完成鉴权后返回的绑定信息 */
  bizType: string | null;
  bizId: string | null;
  url: string;
}

export interface IAttachmentSignedUrl {
  url: string;
  expiresAt: number;
}
