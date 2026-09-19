import { AppConfigForced } from '@/config/configuration.interface';
import {
  mkdir,
  mkdtemp,
  readFile,
  rename,
  rm,
  stat,
  unlink,
  writeFile,
} from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { LocalAttachmentStorageService } from '@/modules/attachments/services/local-attachment-storage.service';
import { initSnowflake, resetSnowflake } from '@/shared/utils/snowflake';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs/promises')>();

  return {
    ...actual,
    rename: vi.fn(actual.rename),
    unlink: vi.fn(actual.unlink),
  };
});

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

  it('returns false when removing a missing file', async () => {
    await expect(service.remove('2026/09/missing.png')).resolves.toBe(false);
  });

  it('returns true when removing an existing file', async () => {
    const key = '2026/09/existing.txt';
    const absolutePath = join(uploadDir, key);
    await mkdir(join(uploadDir, '2026/09'), { recursive: true });
    await writeFile(absolutePath, 'content');

    await expect(service.remove(key)).resolves.toBe(true);
    await expect(stat(absolutePath)).rejects.toThrow();
  });

  it('removes the copied file when removing the temporary file fails', async () => {
    const tempPath = join(uploadDir, 'temp-avatar');
    await writeFile(tempPath, 'image-content');
    const file = {
      originalname: 'avatar.png',
      path: tempPath,
    } as Express.Multer.File;
    const unlinkError = Object.assign(new Error('unlink failed'), {
      code: 'EACCES',
    });

    vi.mocked(rename).mockRejectedValueOnce(
      Object.assign(new Error('cross-device link'), { code: 'EXDEV' }),
    );
    vi.mocked(unlink).mockRejectedValueOnce(unlinkError);

    await expect(service.save(file)).rejects.toBe(unlinkError);

    const permanentPath = vi.mocked(unlink).mock.calls[1]?.[0];
    expect(permanentPath).not.toBe(tempPath);
    await expect(stat(permanentPath as string)).rejects.toMatchObject({
      code: 'ENOENT',
    });
    await expect(stat(tempPath)).resolves.toBeDefined();
  });
});
