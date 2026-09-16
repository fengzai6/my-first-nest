import { beforeEach, describe, expect, it, vi } from "vitest";

const postMock = vi.hoisted(() => vi.fn());
const getMock = vi.hoisted(() => vi.fn());
const patchMock = vi.hoisted(() => vi.fn());
const deleteMock = vi.hoisted(() => vi.fn());

vi.mock("../new-http", () => ({
  default: {
    post: postMock,
    get: getMock,
    patch: patchMock,
    delete: deleteMock,
  },
}));

describe("document API", () => {
  beforeEach(() => {
    postMock.mockReset();
    getMock.mockReset();
    patchMock.mockReset();
    deleteMock.mockReset();
  });

  it("creates a document with POST /documents", async () => {
    const { CreateDocument } = await import("../document");
    postMock.mockResolvedValue({ data: { id: "document-id" } });

    await CreateDocument({ title: "标题", content: "正文" });

    expect(postMock).toHaveBeenCalledWith("/documents", {
      title: "标题",
      content: "正文",
    });
  });

  it("updates a document with PATCH /documents/:id", async () => {
    const { UpdateDocument } = await import("../document");
    patchMock.mockResolvedValue({ data: { id: "document-id" } });

    await UpdateDocument("document-id", { title: "新标题" });

    expect(patchMock).toHaveBeenCalledWith("/documents/document-id", {
      title: "新标题",
    });
  });

  it("deletes a document with DELETE /documents/:id", async () => {
    const { DeleteDocument } = await import("../document");
    deleteMock.mockResolvedValue({ data: undefined });

    await DeleteDocument("document-id");

    expect(deleteMock).toHaveBeenCalledWith("/documents/document-id");
  });

  it("gets a document attachment signed url", async () => {
    const { GetDocumentAttachmentSignedUrl } = await import("../document");
    getMock.mockResolvedValue({ data: { url: "/signed", expiresAt: 1 } });

    await GetDocumentAttachmentSignedUrl("document-id", "attachment-id");

    expect(getMock).toHaveBeenCalledWith(
      "/documents/document-id/attachments/attachment-id/signed-url",
    );
  });
});
