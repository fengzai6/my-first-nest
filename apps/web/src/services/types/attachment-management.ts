import type { IAttachment, IAttachmentSignedUrl } from "./attachment";
import type { IJobRun } from "./job";

export type AttachmentManagementStatus = "bound" | "orphan" | "deleted";
export type AttachmentCleanupStatus = "not_candidate" | "waiting" | "eligible";

export interface IManagementAttachment extends Omit<
  IAttachment,
  "url" | "deletedAt"
> {
  uploadedBy: {
    id: string;
    displayName: string;
  };
  status: AttachmentManagementStatus;
  cleanupStatus: AttachmentCleanupStatus;
  updatedAt: string;
  deletedAt: string | null;
  retentionDeadline?: string | null;
}

export interface IManagementAttachmentsPage {
  list: IManagementAttachment[];
  total: number;
  page: number;
  pageSize: number;
}

export interface IAttachmentBulkResult {
  succeeded: string[];
  failed: {
    id: string;
    reason: string;
  }[];
}

export type { IAttachmentSignedUrl, IJobRun };
