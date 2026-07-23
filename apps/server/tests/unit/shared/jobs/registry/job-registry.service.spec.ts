import {
  ErrorException,
  ErrorExceptionCode,
} from '@/common/exceptions/error.exception';
import { JobRegistryService } from '@/shared/jobs/registry/job-registry.service';
import { IJobHandler } from '@/shared/jobs/types/job.types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const createHandler = (name: string): IJobHandler => ({
  name,
  handle: vi.fn(async () => ({ ok: true })),
});

describe('JobRegistryService', () => {
  let registry: JobRegistryService;

  beforeEach(() => {
    registry = new JobRegistryService();
  });

  it('should register and get handler by name', () => {
    const handler = createHandler('export-report');

    registry.register(handler);

    expect(registry.has('export-report')).toBe(true);
    expect(registry.get('export-report')).toBe(handler);
    expect(registry.listNames()).toEqual(['export-report']);
  });

  it('should reject duplicate handler names', () => {
    registry.register(createHandler('export-report'));

    expect(() => registry.register(createHandler('export-report'))).toThrow(
      'Duplicate job handler registered: export-report',
    );
  });

  it('should throw when handler is missing', () => {
    expect(() => registry.get('missing')).toThrow(ErrorException);
    try {
      registry.get('missing');
    } catch (error) {
      expect(error).toMatchObject({
        code: ErrorExceptionCode.JOB_HANDLER_NOT_FOUND,
      });
    }
  });
});
