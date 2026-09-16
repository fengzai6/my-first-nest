import type { ICreateDocumentDto, IUpdateDocumentDto } from "../dtos/document";
import type {
  IDocument,
  IDocumentsPage,
  IFindDocumentsQuery,
} from "../types/document";
import type { IAttachmentSignedUrl } from "../types/attachment";
import http from "./new-http";

export const CreateDocument = async (data: ICreateDocumentDto) => {
  const response = await http.post<IDocument>("/documents", data);
  return response.data;
};

export const GetDocuments = async (params?: IFindDocumentsQuery) => {
  const response = await http.get<IDocumentsPage>("/documents", { params });
  return response.data;
};

export const GetDocument = async (id: string) => {
  const response = await http.get<IDocument>(`/documents/${id}`);
  return response.data;
};

export const UpdateDocument = async (id: string, data: IUpdateDocumentDto) => {
  const response = await http.patch<IDocument>(`/documents/${id}`, data);
  return response.data;
};

export const DeleteDocument = async (id: string) => {
  const response = await http.delete(`/documents/${id}`);
  return response.data;
};

export const GetDocumentAttachmentSignedUrl = async (
  documentId: string,
  attachmentId: string,
) => {
  const response = await http.get<IAttachmentSignedUrl>(
    `/documents/${documentId}/attachments/${attachmentId}/signed-url`,
  );
  return response.data;
};
