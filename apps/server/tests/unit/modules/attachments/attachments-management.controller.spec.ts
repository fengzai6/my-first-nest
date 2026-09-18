import { AttachmentsManagementController } from '@/modules/attachments/attachments-management.controller';
import type { AttachmentManagementService } from '@/modules/attachments/services/attachment-management.service';
import { describe, expect, it, vi } from 'vitest';

describe('AttachmentsManagementController', () => {
  it('delegates list queries to the management service', async () => {
    const findAll = vi.fn().mockResolvedValue({
      list: [],
      total: 0,
      page: 1,
      pageSize: 20,
    });
    const service = {
      findAll,
    } as unknown as AttachmentManagementService;
    const controller = new AttachmentsManagementController(service);

    await controller.findAll({ page: 1, pageSize: 20 });

    expect(findAll).toHaveBeenCalledWith({ page: 1, pageSize: 20 });
  });
});
