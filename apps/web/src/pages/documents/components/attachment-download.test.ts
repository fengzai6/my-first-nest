import { describe, expect, it, vi } from "vitest";

import { downloadAttachment } from "./attachment-download";

const createDocument = () => {
  const click = vi.fn();
  const remove = vi.fn();
  const appendChild = vi.fn();
  const anchor = {
    href: "",
    download: "",
    click,
    remove,
  } as unknown as HTMLAnchorElement;
  const document = {
    createElement: vi.fn().mockReturnValue(anchor),
    body: {
      appendChild,
    },
  } as unknown as Document;

  return { anchor, appendChild, click, document, remove };
};

describe("downloadAttachment", () => {
  it("downloads the response blob and revokes the object URL", async () => {
    const blob = new Blob(["content"]);
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(blob, {
        status: 200,
      }),
    );
    const createObjectURL = vi.fn().mockReturnValue("blob:attachment");
    const revokeObjectURL = vi.fn();
    const { anchor, appendChild, click, document, remove } = createDocument();

    await downloadAttachment(
      "http://localhost:5173/api/attachments/content/attachment-id?download=1",
      "资料.pdf",
      {
        fetch: fetchMock,
        createObjectURL,
        revokeObjectURL,
        document,
      },
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:5173/api/attachments/content/attachment-id?download=1",
      { credentials: "omit" },
    );
    expect(createObjectURL).toHaveBeenCalledWith(blob);
    expect(anchor.href).toBe("blob:attachment");
    expect(anchor.download).toBe("资料.pdf");
    expect(appendChild).toHaveBeenCalledWith(anchor);
    expect(click).toHaveBeenCalledTimes(1);
    expect(remove).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:attachment");
  });

  it("rejects a failed download response without creating an object URL", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(null, {
        status: 500,
      }),
    );
    const createObjectURL = vi.fn();
    const revokeObjectURL = vi.fn();

    await expect(
      downloadAttachment("http://localhost:5173/download", "资料.pdf", {
        fetch: fetchMock,
        createObjectURL,
        revokeObjectURL,
        document: createDocument().document,
      }),
    ).rejects.toThrow("下载请求失败（500）");

    expect(createObjectURL).not.toHaveBeenCalled();
    expect(revokeObjectURL).not.toHaveBeenCalled();
  });
});
