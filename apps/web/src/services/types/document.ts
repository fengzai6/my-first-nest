import type { IAttachment } from "./attachment";

export const DOCUMENT_STATUS = {
  DRAFT: "draft",
  PUBLISHED: "published",
} as const;

export type DocumentStatus =
  (typeof DOCUMENT_STATUS)[keyof typeof DOCUMENT_STATUS];

export interface IDocumentOwner {
  id: string;
  displayName: string;
}

export interface IDeletedDocumentOwner {
  id: "";
  displayName: "已删除用户";
}

export interface IDocumentListItem {
  id: string;
  title: string;
  status: DocumentStatus;
  owner: IDocumentOwner | IDeletedDocumentOwner;
  attachmentCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface IDocument {
  id: string;
  title: string;
  content: string;
  status: DocumentStatus;
  owner: IDocumentOwner | IDeletedDocumentOwner;
  attachments: IAttachment[];
  createdAt: string;
  updatedAt: string;
}

export interface IDocumentsPage {
  list: IDocumentListItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface IFindDocumentsQuery {
  page?: number;
  pageSize?: number;
  status?: DocumentStatus;
  keyword?: string;
}
