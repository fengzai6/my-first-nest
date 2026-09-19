import { GetAttachmentSignedUrl } from "@/services/api/attachment";
import { GetDocumentAttachmentSignedUrl } from "@/services/api/document";
import type { IAttachmentSignedUrl } from "@/services/types/attachment";

export const getDocumentFormAttachmentSignedUrl = (
  documentId: string,
  attachment: { bizType: string | null; bizId: string | null },
  attachmentId: string,
): Promise<IAttachmentSignedUrl> => {
  if (attachment.bizType === "document" && attachment.bizId === documentId) {
    return GetDocumentAttachmentSignedUrl(documentId, attachmentId);
  }

  return GetAttachmentSignedUrl(attachmentId);
};
