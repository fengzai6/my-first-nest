interface IDownloadAttachmentOptions {
  fetch?: typeof fetch;
  createObjectURL?: (blob: Blob) => string;
  revokeObjectURL?: (url: string) => void;
  document?: Document;
}

const getResponseFilename = (
  contentDisposition: string | null,
  fallback: string,
) => {
  if (!contentDisposition) return fallback;

  const encodedMatch = contentDisposition.match(
    /filename\*\s*=\s*UTF-8''([^;]+)/i,
  );
  if (encodedMatch?.[1]) {
    try {
      return decodeURIComponent(encodedMatch[1].trim());
    } catch {
      return fallback;
    }
  }

  const plainMatch = contentDisposition.match(
    /filename\s*=\s*"([^"]+)"|filename\s*=\s*([^;]+)/i,
  );
  return plainMatch?.[1]?.trim() || plainMatch?.[2]?.trim() || fallback;
};

export const downloadAttachment = async (
  url: string,
  filename: string,
  options: IDownloadAttachmentOptions = {},
) => {
  const downloadFetch = options.fetch ?? fetch;
  const createObjectURL =
    options.createObjectURL ?? ((blob: Blob) => URL.createObjectURL(blob));
  const revokeObjectURL =
    options.revokeObjectURL ??
    ((objectUrl: string) => URL.revokeObjectURL(objectUrl));
  const downloadDocument = options.document ?? document;
  const response = await downloadFetch(url, {
    credentials: "omit",
  });

  if (!response.ok) {
    throw new Error(`下载请求失败（${response.status}）`);
  }

  const responseFilename = getResponseFilename(
    response.headers.get("Content-Disposition"),
    filename,
  );
  const objectUrl = createObjectURL(await response.blob());
  const anchor = downloadDocument.createElement("a");
  anchor.href = objectUrl;
  anchor.download = responseFilename;
  downloadDocument.body.appendChild(anchor);

  try {
    anchor.click();
  } finally {
    anchor.remove();
    revokeObjectURL(objectUrl);
  }
};
