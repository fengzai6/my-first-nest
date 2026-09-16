import { AppConfigForced } from '@/config/configuration.interface';
import { mkdtemp, readFile, rm, stat, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { LocalAttachmentStorageService } from '@/modules/attachments/services/local-attachment-storage.service';
import { initSnowflake, resetSnowflake } from '@/shared/utils/snowflake';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

describe('LocalAttachmentStorageService', () => {
  let uploadDir: string;
  let service: LocalAttachmentStorageService;

  beforeEach(async () => {
    initSnowflake(0n, 0n);
    uploadDir = await mkdtemp(join(tmpdir(), 'attachments-'));
    const config = {
      upload: { dir: uploadDir },
    } as AppConfigForced;

    service = new LocalAttachmentStorageService(config);
  });

  afterEach(async () => {
    resetSnowflake();
    await rm(uploadDir, { recursive: true, force: true });
  });

  it('saves a file under a generated storage key', async () => {
    const tempPath = join(uploadDir, 'temp-avatar');
    await writeFile(tempPath, 'image-content');
    const file = {
      originalname: 'avatar.PNG',
      path: tempPath,
    } as Express.Multer.File;

    const result = await service.save(file);

    expect(result.key).toMatch(/^\d{4}\/\d{2}\/\d+\.png$/);
    await expect(readFile(join(uploadDir, result.key), 'utf8')).resolves.toBe(
      'image-content',
    );
    await expect(stat(tempPath)).rejects.toThrow();
  });

  it('rejects path traversal keys', async () => {
    await expect(service.read('../secret.txt')).rejects.toThrow(
      'Invalid storage key',
    );
  });
});
