import { Readable } from 'stream';

export interface IStoredFile {
  key: string;
}

export interface IReadableStoredFile {
  stream: Readable;
  mimeType?: string;
}

export interface IAttachmentStorage {
  save(file: Express.Multer.File): Promise<IStoredFile>;
  read(key: string): Promise<IReadableStoredFile>;
  remove(key: string): Promise<boolean>;
  cleanup(file: Express.Multer.File): Promise<void>;
}

export const ATTACHMENT_STORAGE = Symbol('ATTACHMENT_STORAGE');
