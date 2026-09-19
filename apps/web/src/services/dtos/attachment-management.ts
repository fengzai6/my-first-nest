import type { AttachmentVisibility } from "../types/attachment";
import type {
  AttachmentCleanupStatus,
  AttachmentManagementStatus,
} from "../types/attachment-management";

export interface IFindManagementAttachmentsQuery {
  page?: number;
  pageSize?: number;
  keyword?: string;
  mimeType?: string;
  visibility?: AttachmentVisibility;
  bizType?: string;
  bizId?: string;
  uploader?: string;
  includeDeleted?: boolean;
  orphanOnly?: boolean;
  createdFrom?: string;
  createdTo?: string;
}

export interface IManagementAttachmentFilters {
  keyword?: string;
  mimeType?: string;
  visibility?: AttachmentVisibility;
  status?: AttachmentManagementStatus;
  cleanupStatus?: AttachmentCleanupStatus;
}
