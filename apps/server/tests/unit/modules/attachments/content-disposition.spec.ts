import { encodeRFC5987ValueChars } from '@/modules/attachments/attachments.controller';
import { describe, expect, it } from 'vitest';

describe('encodeRFC5987ValueChars', () => {
  it('encodes unsafe filename characters for a response header', () => {
    const filename = '资料 报告";.pdf';

    expect(encodeRFC5987ValueChars(filename)).toBe(
      '%E8%B5%84%E6%96%99%20%E6%8A%A5%E5%91%8A%22%3B.pdf',
    );
    expect(encodeRFC5987ValueChars(filename)).not.toContain('"');
    expect(encodeRFC5987ValueChars(filename)).not.toContain('\r');
    expect(encodeRFC5987ValueChars(filename)).not.toContain('\n');
  });
});
