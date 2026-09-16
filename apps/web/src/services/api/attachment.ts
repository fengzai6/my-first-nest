import type {
  IUpdateAttachmentDto,
  IUploadAttachmentDto,
} from "../dtos/attachment";
import type { IAttachment, IAttachmentSignedUrl } from "../types/attachment";
import http from "./new-http";

export const UploadAttachment = async (data: IUploadAttachmentDto) => {
  const formData = new FormData();

  data.files.forEach((file) => {
    formData.append("files", file);
  });

  if (data.visibility) formData.append("visibility", data.visibility);

  const res = await http.post<IAttachment[]>("/attachments", formData);

  return res.data;
};

export const GetAttachmentSignedUrl = async (id: string) => {
  const res = await http.get<IAttachmentSignedUrl>(
    `/attachments/${id}/signed-url`,
  );

  return res.data;
};

export const UpdateAttachment = async (
  id: string,
  data: IUpdateAttachmentDto,
) => {
  const res = await http.patch<IAttachment>(`/attachments/${id}`, data);

  return res.data;
};

export const DeleteAttachment = async (id: string) => {
  const res = await http.delete(`/attachments/${id}`);

  return res.data;
};
