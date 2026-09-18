export const resolveAttachmentUrl = (url: string, origin: string) =>
  new URL(url, origin).toString();

export const createAttachmentDownloadUrl = (url: string, origin: string) => {
  const downloadUrl = new URL(resolveAttachmentUrl(url, origin));
  downloadUrl.searchParams.set("download", "1");
  return downloadUrl.toString();
};
