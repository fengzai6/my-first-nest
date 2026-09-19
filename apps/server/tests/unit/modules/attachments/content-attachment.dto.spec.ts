import { ContentAttachmentDto } from '@/modules/attachments/dto/content-attachment.dto';
import { plainToInstance } from 'class-transformer';
import { describe, expect, it } from 'vitest';

describe('ContentAttachmentDto', () => {
  it('maps download=1 to true', () => {
    const dto = plainToInstance(ContentAttachmentDto, { download: '1' });

    expect(dto.download).toBe(true);
  });

  it('leaves other download values unchanged for validation', () => {
    const dto = plainToInstance(ContentAttachmentDto, { download: '0' });

    expect(dto.download).toBe('0');
  });
});
