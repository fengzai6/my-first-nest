import { ContentAttachmentDto } from '@/modules/attachments/dto/content-attachment.dto';
import { plainToInstance } from 'class-transformer';
import { describe, expect, it } from 'vitest';

describe('ContentAttachmentDto scope', () => {
  it('defaults to user scope', () => {
    const dto = plainToInstance(ContentAttachmentDto, {});

    expect(dto.scope).toBe('user');
  });

  it('maps admin scope from the query string', () => {
    const dto = plainToInstance(ContentAttachmentDto, { scope: 'admin' });

    expect(dto.scope).toBe('admin');
  });
});
