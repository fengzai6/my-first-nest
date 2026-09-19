import type { IAttachmentBulkResult } from "@/services/types/attachment-management";

export const getRemainingSelectionIds = (
  selectedIds: string[],
  result: IAttachmentBulkResult,
) => {
  const succeededIds = new Set(result.succeeded);
  return selectedIds.filter((id) => !succeededIds.has(id));
};

export const getBulkFailureLines = (
  failures: IAttachmentBulkResult["failed"],
) => failures.map(({ id, reason }) => `${id}：${reason}`).join("；");
