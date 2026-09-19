import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { ParseBigIntPipe } from '@/common/pipes/parse-bigint.pipe';

describe('ParseBigIntPipe', () => {
  it('keeps a decimal bigint string unchanged', () => {
    const pipe = new ParseBigIntPipe();

    expect(pipe.transform('9007199254740993')).toBe('9007199254740993');
  });

  it('rejects non-decimal id values', () => {
    const pipe = new ParseBigIntPipe();

    expect(() => pipe.transform('12abc')).toThrow(BadRequestException);
    expect(() => pipe.transform('-1')).toThrow(BadRequestException);
  });
});
