interface IDownloadAttachmentOptions {
  fetch?: typeof fetch;
  createObjectURL?: (blob: Blob) => string;
  revokeObjectURL?: (url: string) => void;
  document?: Document;
}

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

  const objectUrl = createObjectURL(await response.blob());
  const anchor = downloadDocument.createElement("a");
  anchor.href = objectUrl;
  anchor.download = filename;
  downloadDocument.body.appendChild(anchor);

  try {
    anchor.click();
  } finally {
    anchor.remove();
    revokeObjectURL(objectUrl);
  }
};
