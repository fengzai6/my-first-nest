import { normalizeMultipartFilename } from '@/modules/attachments/utils/normalize-multipart-filename';
import { describe, expect, it } from 'vitest';

describe('normalizeMultipartFilename', () => {
  it('restores a UTF-8 filename decoded as latin1 by multipart parsing', () => {
    const original = '资料 报告";.pdf';
    const mojibake = Buffer.from(original, 'utf8').toString('latin1');

    expect(normalizeMultipartFilename(mojibake)).toBe(original);
  });

  it('keeps an already correct filename unchanged', () => {
    expect(normalizeMultipartFilename('资料 预览.pdf')).toBe('资料 预览.pdf');
  });

  it('keeps a correct non-ASCII filename that does not look like mojibake', () => {
    expect(normalizeMultipartFilename('中.pdf')).toBe('中.pdf');
  });

  it('keeps ordinary ASCII filenames unchanged', () => {
    expect(normalizeMultipartFilename('report.pdf')).toBe('report.pdf');
  });
});
