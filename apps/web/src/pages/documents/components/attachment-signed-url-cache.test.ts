import { describe, expect, it, vi } from "vitest";

import { createAttachmentSignedUrlCache } from "./attachment-signed-url-cache";

describe("createAttachmentSignedUrlCache", () => {
  it("reuses a signed url before the safety margin expires", async () => {
    const now = 1_000_000;
    const request = vi.fn().mockResolvedValue({
      url: "/signed",
      expiresAt: now + 300_000,
    });
    const cache = createAttachmentSignedUrlCache(request, () => now);

    await expect(cache.get()).resolves.toMatchObject({ url: "/signed" });
    await expect(cache.get()).resolves.toMatchObject({ url: "/signed" });

    expect(request).toHaveBeenCalledTimes(1);
  });

  it("reissues a signed url inside the safety margin", async () => {
    let now = 1_000_000;
    const request = vi
      .fn()
      .mockResolvedValueOnce({
        url: "/old",
        expiresAt: now + 60_000,
      })
      .mockResolvedValueOnce({
        url: "/new",
        expiresAt: now + 300_000,
      });
    const cache = createAttachmentSignedUrlCache(request, () => now);

    await expect(cache.get()).resolves.toMatchObject({ url: "/old" });
    now += 60_000;
    await expect(cache.get()).resolves.toMatchObject({ url: "/new" });

    expect(request).toHaveBeenCalledTimes(2);
  });

  it("clears a rejected request so a later action can retry", async () => {
    const request = vi
      .fn()
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce({ url: "/retry", expiresAt: Date.now() + 300_000 });
    const cache = createAttachmentSignedUrlCache(request);

    await expect(cache.get()).rejects.toThrow("network");
    await expect(cache.get()).resolves.toMatchObject({ url: "/retry" });

    expect(request).toHaveBeenCalledTimes(2);
  });
});
