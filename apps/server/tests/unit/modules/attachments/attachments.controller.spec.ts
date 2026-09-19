import { AttachmentsController } from '@/modules/attachments/attachments.controller';
import { AttachmentsService } from '@/modules/attachments/attachments.service';
import { ATTACHMENT_STORAGE } from '@/modules/attachments/interfaces/attachment-storage.interface';
import { DECORATORS } from '@nestjs/swagger/dist/constants';
import { describe, expect, it } from 'vitest';

const getSecurityMetadata = (method: object) =>
  Reflect.getMetadata(DECORATORS.API_SECURITY, method) as
    | Array<Record<string, string[]>>
    | undefined;

describe('AttachmentsController Swagger metadata', () => {
  it('requires bearer auth only on protected routes', () => {
    const controller = new AttachmentsController(
      {} as AttachmentsService,
      {} as never,
    );

    expect(
      Reflect.getMetadata(DECORATORS.API_SECURITY, AttachmentsController),
    ).toBeUndefined();
    expect(getSecurityMetadata(controller.upload)).toEqual([{ bearer: [] }]);
    expect(getSecurityMetadata(controller.getSignedUrl)).toEqual([
      { bearer: [] },
    ]);
    expect(getSecurityMetadata(controller.update)).toEqual([{ bearer: [] }]);
    expect(getSecurityMetadata(controller.remove)).toEqual([{ bearer: [] }]);
    expect(getSecurityMetadata(controller.getContent)).toBeUndefined();
  });
});
