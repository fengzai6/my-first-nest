import { DisabledEndpointExceptionCode } from '@/common/exceptions/disabled-endpoint.exception';
import { DisabledEndpointGuard } from '@/common/guards/disabled-endpoint.guard';
import { describe, expect, it } from 'vitest';

describe('DisabledEndpointGuard', () => {
  it('should always reject request with disabled endpoint exception', () => {
    const guard = new DisabledEndpointGuard();

    expect(() => guard.canActivate()).toThrow(
      expect.objectContaining({
        code: DisabledEndpointExceptionCode.ENDPOINT_DISABLED,
      }),
    );
  });
});
