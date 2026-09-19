import type { IAttachmentSignedUrl } from "@/services/types/attachment";

const EXPIRY_SAFETY_MARGIN_MS = 30_000;

export const createAttachmentSignedUrlCache = (
  request: () => Promise<IAttachmentSignedUrl>,
  now = () => Date.now(),
) => {
  let cached: Promise<IAttachmentSignedUrl> | null = null;
  let expiresAt = 0;

  return {
    get() {
      if (cached && expiresAt - now() > EXPIRY_SAFETY_MARGIN_MS) {
        return cached;
      }

      expiresAt = 0;
      cached = request()
        .then((signedUrl) => {
          expiresAt = signedUrl.expiresAt;
          return signedUrl;
        })
        .catch((error) => {
          cached = null;
          throw error;
        });

      return cached;
    },
  };
};
