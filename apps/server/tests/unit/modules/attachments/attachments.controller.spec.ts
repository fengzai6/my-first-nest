import type { Attachment } from '@/modules/attachments/entities/attachment.entity';
import { AttachmentsController } from '@/modules/attachments/attachments.controller';
import type { AttachmentsService } from '@/modules/attachments/attachments.service';
import type { IAttachmentStorage } from '@/modules/attachments/interfaces/attachment-storage.interface';
import type { Response } from 'express';
import { Readable, Writable } from 'stream';
import { describe, expect, it, vi } from 'vitest';

const createResponse = () => {
  const headers = new Map<string, string>();
  const response = new Writable({
    write(_chunk, _encoding, callback) {
      callback();
    },
  });
  Object.assign(response, {
    setHeader: vi.fn((name: string, value: string) => {
      headers.set(name, value);
    }),
  });

  return { headers, response: response as unknown as Response };
};

describe('AttachmentsController', () => {
  it('keeps octet-stream content type and safely encodes an unsafe filename', async () => {
    const attachment = {
      id: 'attachment-id',
      originalName: 'report\r\nX-Injected: yes.pdf',
      mimeType: 'application/octet-stream',
    } as Attachment;
    const service = {
      getContent: vi.fn().mockResolvedValue({
        attachment,
        content: { stream: Readable.from('content') },
      }),
    } as unknown as AttachmentsService;
    const controller = new AttachmentsController(
      service,
      {} as never as IAttachmentStorage,
    );
    const { headers, response } = createResponse();

    await controller.getContent('attachment-id', { download: true }, response);

    expect(headers.get('Content-Type')).toBe('application/octet-stream');
    expect(headers.get('Content-Disposition')).toBe(
      "attachment; filename*=UTF-8''report%0D%0AX-Injected%3A%20yes.pdf",
    );
    expect(headers.get('Content-Disposition')).not.toContain('\r');
    expect(headers.get('Content-Disposition')).not.toContain('\n');
  });
});
