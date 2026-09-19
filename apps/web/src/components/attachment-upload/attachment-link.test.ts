import { describe, expect, it } from "vitest";

import {
  createAttachmentDownloadUrl,
  resolveAttachmentUrl,
} from "./attachment-link";

describe("attachment link helpers", () => {
  it("把相对附件地址解析为浏览器当前 origin 的绝对地址", () => {
    expect(
      resolveAttachmentUrl(
        "/api/attachments/content/attachment-id?signature=signed",
        "http://localhost:5173",
      ),
    ).toBe(
      "http://localhost:5173/api/attachments/content/attachment-id?signature=signed",
    );
  });

  it("保留已经是绝对地址的附件 URL", () => {
    const url =
      "https://cdn.example.com/attachments/attachment-id?signature=signed";

    expect(resolveAttachmentUrl(url, "http://localhost:5173")).toBe(url);
  });

  it("为公开和签名附件地址添加下载参数且保留原查询参数", () => {
    expect(
      createAttachmentDownloadUrl(
        "/api/attachments/content/attachment-id?expiresAt=1&userId=2&signature=signed",
        "http://localhost:5173",
      ),
    ).toBe(
      "http://localhost:5173/api/attachments/content/attachment-id?expiresAt=1&userId=2&signature=signed&download=1",
    );
  });
});
