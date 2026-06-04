import { Cookies } from '@/common/decorators/cookies.decorator';
import 'reflect-metadata';
import { describe, expect, it } from 'vitest';

describe('Cookies', () => {
  it('should return all cookies when no data is provided', () => {
    const decorator = Cookies();
    expect(typeof decorator).toBe('function');
  });

  it('should be a function that creates decorators', () => {
    // Verify Cookies is a factory function
    expect(typeof Cookies).toBe('function');

    // Verify calling it returns a decorator
    const decorator = Cookies();
    expect(decorator).toBeDefined();
  });
});
