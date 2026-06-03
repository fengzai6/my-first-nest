import { afterEach, describe, expect, it, vi } from 'vitest';
import { withTimeout } from '@/shared/utils/promise';

describe('withTimeout', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('should resolve when promise completes before timeout', async () => {
    await expect(
      withTimeout(Promise.resolve('done'), 1000, 'timeout'),
    ).resolves.toBe('done');
  });

  it('should reject when promise exceeds timeout', async () => {
    vi.useFakeTimers();

    const result = withTimeout(new Promise(() => {}), 1000, 'timeout');
    const expectation = expect(result).rejects.toThrow('timeout');

    await vi.advanceTimersByTimeAsync(1000);
    await expectation;
  });
});
