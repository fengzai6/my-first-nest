import { ErrorExceptionCode } from '@/common/exceptions/error.exception';
import { LogController } from '@/shared/log/log.controller';
import { LogService } from '@/shared/log/log.service';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const createController = () => {
  const logs = {
    getById: vi.fn(),
    list: vi.fn(),
  };
  const controller = new LogController(logs as unknown as LogService);

  return { controller, logs };
};

describe('LogController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('delegates list queries to LogService', async () => {
    const { controller, logs } = createController();
    const query = {
      page: 2,
      pageSize: 10,
      startTime: '2026-09-01T00:00:00.000Z',
      endTime: '2026-09-02T00:00:00.000Z',
    };

    await controller.list(query);

    expect(logs.list).toHaveBeenCalledWith({
      page: 2,
      pageSize: 10,
      startTime: new Date(query.startTime),
      endTime: new Date(query.endTime),
    });
  });

  it('propagates LOG_NOT_FOUND from LogService', async () => {
    const { controller, logs } = createController();

    logs.getById.mockRejectedValue(
      Object.assign(new Error('日志不存在'), {
        code: ErrorExceptionCode.LOG_NOT_FOUND,
      }),
    );

    await expect(controller.getById('missing')).rejects.toMatchObject({
      code: ErrorExceptionCode.LOG_NOT_FOUND,
    });
  });
});
