export const DOCUMENT_STATUS = {
  DRAFT: 'draft',
  PUBLISHED: 'published',
} as const;

export type DocumentStatus =
  (typeof DOCUMENT_STATUS)[keyof typeof DOCUMENT_STATUS];
