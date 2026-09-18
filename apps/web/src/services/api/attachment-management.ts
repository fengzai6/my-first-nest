import type { AttachmentVisibility } from "../types/attachment";
import type {
  IAttachmentBulkResult,
  IManagementAttachment,
  IManagementAttachmentsPage,
  IJobRun,
} from "../types/attachment-management";
import type { IFindManagementAttachmentsQuery } from "../dtos/attachment-management";
import http from "./new-http";

export const GetManagementAttachments = async (
  params?: IFindManagementAttachmentsQuery,
) => {
  const response = await http.get<IManagementAttachmentsPage>(
    "/attachments/management",
    { params },
  );
  return response.data;
};

export const GetManagementAttachment = async (id: string) => {
  const response = await http.get<IManagementAttachment>(
    `/attachments/management/${id}`,
  );
  return response.data;
};

export const GetManagementAttachmentSignedUrl = async (id: string) => {
  const response = await http.get<{ url: string; expiresAt: number }>(
    `/attachments/management/${id}/signed-url`,
  );
  return response.data;
};

export const UpdateManagementAttachmentVisibility = async (
  id: string,
  visibility: AttachmentVisibility,
) => {
  const response = await http.patch<IManagementAttachment>(
    `/attachments/management/${id}/visibility`,
    { visibility },
  );
  return response.data;
};

export const SoftDeleteManagementAttachment = async (id: string) => {
  await http.post(`/attachments/management/${id}/soft-delete`);
};

export const BulkUpdateManagementVisibility = async (
  ids: string[],
  visibility: AttachmentVisibility,
) => {
  const response = await http.patch<IAttachmentBulkResult>(
    "/attachments/management/bulk/visibility",
    { ids, visibility },
  );
  return response.data;
};

export const BulkSoftDeleteManagementAttachments = async (ids: string[]) => {
  const response = await http.post<IAttachmentBulkResult>(
    "/attachments/management/bulk/soft-delete",
    { ids },
  );
  return response.data;
};

export const TriggerManagementCleanup = async () => {
  const response = await http.post<IJobRun>("/attachments/management/cleanup");
  return response.data;
};

export const GetLatestManagementCleanup = async () => {
  const response = await http.get<IJobRun | null>(
    "/attachments/management/cleanup/latest",
  );
  return response.data;
};
