import type { IAttachmentBulkResult } from "@/services/types/attachment-management";

export const getRemainingSelectionIds = (
  selectedIds: string[],
  result: IAttachmentBulkResult,
) => {
  const failedIds = new Set(result.failed.map((item) => item.id));
  return selectedIds.filter((id) => failedIds.has(id));
};

export const getBulkFailureLines = (
  failures: IAttachmentBulkResult["failed"],
) => failures.map(({ id, reason }) => `${id}：${reason}`).join("；");
