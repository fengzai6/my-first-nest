import { AttachmentSignatureService } from '@/modules/attachments/attachment-signature.service';
import { AppConfigForced } from '@/config/configuration.interface';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const createService = () => {
  const config = {
    upload: {
      secret: 'test-secret',
      signedUrlExpiresIn: 300,
      urlPrefix: '/api/attachments/content',
    },
  } as AppConfigForced;

  return new AttachmentSignatureService(config);
};

describe('AttachmentSignatureService', () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it('creates and verifies a signature', () => {
    const service = createService();
    const { url } = service.createSignedUrl('attachment-id', 'user-id');
    const parsed = new URL(url, 'http://localhost');

    expect(
      service.verifySignature(
        'attachment-id',
        'user-id',
        Number(parsed.searchParams.get('expiresAt')),
        parsed.searchParams.get('signature') ?? '',
      ),
    ).toBe(true);
  });

  it('rejects a tampered attachment id', () => {
    const service = createService();
    const { url } = service.createSignedUrl('attachment-id', 'user-id');
    const parsed = new URL(url, 'http://localhost');

    expect(
      service.verifySignature(
        'other-id',
        'user-id',
        Number(parsed.searchParams.get('expiresAt')),
        parsed.searchParams.get('signature') ?? '',
      ),
    ).toBe(false);
  });

  it('rejects a tampered user id', () => {
    const service = createService();
    const { url } = service.createSignedUrl('attachment-id', 'user-id');
    const parsed = new URL(url, 'http://localhost');

    expect(
      service.verifySignature(
        'attachment-id',
        'other-user',
        Number(parsed.searchParams.get('expiresAt')),
        parsed.searchParams.get('signature') ?? '',
      ),
    ).toBe(false);
  });

  it('rejects an expired signature', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-13T00:00:00.000Z'));
    const service = createService();
    const { url } = service.createSignedUrl('attachment-id', 'user-id');
    const parsed = new URL(url, 'http://localhost');

    vi.advanceTimersByTime(301_000);

    expect(
      service.verifySignature(
        'attachment-id',
        'user-id',
        Number(parsed.searchParams.get('expiresAt')),
        parsed.searchParams.get('signature') ?? '',
      ),
    ).toBe(false);
  });
});
