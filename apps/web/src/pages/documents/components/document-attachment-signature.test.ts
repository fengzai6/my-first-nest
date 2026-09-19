import type { IAttachment } from "@/services/types/attachment";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDocumentFormAttachmentSignedUrl } from "./document-attachment-signature";

const getAttachmentSignedUrlMock = vi.hoisted(() => vi.fn());
const getDocumentAttachmentSignedUrlMock = vi.hoisted(() => vi.fn());

vi.mock("@/services/api/attachment", () => ({
  GetAttachmentSignedUrl: getAttachmentSignedUrlMock,
}));

vi.mock("@/services/api/document", () => ({
  GetDocumentAttachmentSignedUrl: getDocumentAttachmentSignedUrlMock,
}));

const createAttachment = (
  overrides: Partial<IAttachment> = {},
): IAttachment => ({
  id: "attachment-id",
  originalName: "document.pdf",
  mimeType: "application/pdf",
  size: 1024,
  visibility: "private",
  storageProvider: "local",
  bizType: null,
  bizId: null,
  url: "/api/attachments/content/attachment-id",
  createdAt: "2026-09-17T00:00:00.000Z",
  updatedAt: "2026-09-17T00:00:00.000Z",
  ...overrides,
});

describe("getDocumentFormAttachmentSignedUrl", () => {
  beforeEach(() => {
    getAttachmentSignedUrlMock.mockReset();
    getDocumentAttachmentSignedUrlMock.mockReset();
    getAttachmentSignedUrlMock.mockResolvedValue({
      url: "/generic-signed",
      expiresAt: 1,
    });
    getDocumentAttachmentSignedUrlMock.mockResolvedValue({
      url: "/document-signed",
      expiresAt: 1,
    });
  });

  it("使用文档权限接口签发当前文档已绑定附件", async () => {
    const attachment = createAttachment({
      bizType: "document",
      bizId: "document-id",
    });

    await getDocumentFormAttachmentSignedUrl(
      "document-id",
      attachment,
      attachment.id,
    );

    expect(getDocumentAttachmentSignedUrlMock).toHaveBeenCalledWith(
      "document-id",
      "attachment-id",
    );
    expect(getAttachmentSignedUrlMock).not.toHaveBeenCalled();
  });

  it("使用上传者权限接口签发新上传的未绑定附件", async () => {
    const attachment = createAttachment();

    await getDocumentFormAttachmentSignedUrl(
      "document-id",
      attachment,
      attachment.id,
    );

    expect(getAttachmentSignedUrlMock).toHaveBeenCalledWith("attachment-id");
    expect(getDocumentAttachmentSignedUrlMock).not.toHaveBeenCalled();
  });

  it("其他文档的附件不使用当前文档权限接口", async () => {
    const attachment = createAttachment({
      bizType: "document",
      bizId: "other-document-id",
    });

    await getDocumentFormAttachmentSignedUrl(
      "document-id",
      attachment,
      attachment.id,
    );

    expect(getAttachmentSignedUrlMock).toHaveBeenCalledWith("attachment-id");
    expect(getDocumentAttachmentSignedUrlMock).not.toHaveBeenCalled();
  });
});
