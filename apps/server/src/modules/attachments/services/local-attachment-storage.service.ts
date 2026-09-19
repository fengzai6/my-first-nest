import { Injectable } from '@nestjs/common';
import { createReadStream } from 'fs';
import { access, copyFile, mkdir, rename, unlink } from 'fs/promises';
import { extname, relative, resolve, sep } from 'path';
import { AppConfigForced } from '@/config/configuration.interface';
import { generateSnowflakeId } from '@/shared/utils/snowflake';
import {
  IAttachmentStorage,
  IReadableStoredFile,
  IStoredFile,
} from '../interfaces/attachment-storage.interface';

@Injectable()
export class LocalAttachmentStorageService implements IAttachmentStorage {
  private readonly rootDir: string;

  constructor(config: AppConfigForced) {
    this.rootDir = resolve(process.cwd(), config.upload.dir);
  }

  async save(file: Express.Multer.File): Promise<IStoredFile> {
    const now = new Date();
    const year = now.getUTCFullYear().toString();
    const month = `${now.getUTCMonth() + 1}`.padStart(2, '0');
    const extension = this.getSafeExtension(file.originalname);
    const filename = `${generateSnowflakeId()}${extension}`;
    const key = `${year}/${month}/${filename}`;
    const absolutePath = this.resolveKey(key);
    const tempPath = file.path;

    if (!tempPath) {
      throw new Error('Multer temporary file path is required');
    }

    await mkdir(resolve(absolutePath, '..'), { recursive: true });

    try {
      await rename(tempPath, absolutePath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EXDEV') {
        throw error;
      }

      await copyFile(tempPath, absolutePath);
      try {
        await unlink(tempPath);
      } catch (error) {
        await unlink(absolutePath).catch(() => undefined);
        throw error;
      }
    }

    return { key };
  }

  async read(key: string): Promise<IReadableStoredFile> {
    const absolutePath = this.resolveKey(key);

    await access(absolutePath);

    return {
      stream: createReadStream(absolutePath),
    };
  }

  async remove(key: string): Promise<void> {
    try {
      await unlink(this.resolveKey(key));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }

  async cleanup(file: Express.Multer.File): Promise<void> {
    if (!file.path) return;

    try {
      await unlink(file.path);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }

  private resolveKey(key: string): string {
    const absolutePath = resolve(this.rootDir, key);
    const relativePath = relative(this.rootDir, absolutePath);

    if (
      relativePath === '' ||
      relativePath === '..' ||
      relativePath.startsWith(`..${sep}`) ||
      resolve(relativePath) === relativePath
    ) {
      throw new Error('Invalid storage key');
    }

    return absolutePath;
  }

  private getSafeExtension(originalName: string): string {
    const extension = extname(originalName).toLowerCase();

    if (!extension || !/^\.[a-z0-9]{1,10}$/.test(extension)) {
      return '';
    }

    return extension;
  }
}
