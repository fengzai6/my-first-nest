import type { AttachmentVisibility } from "../types/attachment";

export interface IUploadAttachmentDto {
  files: File[];
  visibility?: AttachmentVisibility;
}

export interface IUpdateAttachmentDto {
  visibility?: AttachmentVisibility;
}
