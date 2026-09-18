import { beforeEach, describe, expect, it, vi } from "vitest";

const getMock = vi.hoisted(() => vi.fn());
const postMock = vi.hoisted(() => vi.fn());
const patchMock = vi.hoisted(() => vi.fn());

vi.mock("../new-http", () => ({
  default: {
    get: getMock,
    post: postMock,
    patch: patchMock,
  },
}));

describe("attachment management api", () => {
  beforeEach(() => {
    getMock.mockReset();
    postMock.mockReset();
    patchMock.mockReset();
  });

  it("gets the management list with query params", async () => {
    getMock.mockResolvedValue({ data: { list: [], total: 0 } });
    const { GetManagementAttachments } =
      await import("../attachment-management");

    await GetManagementAttachments({ page: 2, orphanOnly: true });

    expect(getMock).toHaveBeenCalledWith("/attachments/management", {
      params: { page: 2, orphanOnly: true },
    });
  });

  it("gets the admin signed url", async () => {
    getMock.mockResolvedValue({ data: { url: "/signed", expiresAt: 1 } });
    const { GetManagementAttachmentSignedUrl } =
      await import("../attachment-management");

    await GetManagementAttachmentSignedUrl("attachment-id");

    expect(getMock).toHaveBeenCalledWith(
      "/attachments/management/attachment-id/signed-url",
    );
  });
});
