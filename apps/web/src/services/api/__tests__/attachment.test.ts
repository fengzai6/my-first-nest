import { beforeEach, describe, expect, it, vi } from "vitest";

const postMock = vi.hoisted(() => vi.fn());

vi.mock("../new-http", () => ({
  default: {
    post: postMock,
  },
}));

describe("UploadAttachment", () => {
  beforeEach(() => {
    postMock.mockReset();
  });

  it("posts form data under the files field", async () => {
    const { UploadAttachment } = await import("../attachment");
    const file = new File(["content"], "avatar.png", { type: "image/png" });
    postMock.mockResolvedValue({ data: [] });

    await UploadAttachment({
      files: [file],
      visibility: "public",
    });

    const [url, formData] = postMock.mock.calls[0] as [string, FormData];

    expect(url).toBe("/attachments");
    expect(formData.get("files")).toBe(file);
    expect(formData.has("bizType")).toBe(false);
    expect(formData.get("visibility")).toBe("public");
  });
});
