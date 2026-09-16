import type { DocumentStatus } from "../types/document";

export interface ICreateDocumentDto {
  title: string;
  content: string;
  status?: DocumentStatus;
  attachmentIds?: string[];
}

export type IUpdateDocumentDto = Partial<ICreateDocumentDto>;
