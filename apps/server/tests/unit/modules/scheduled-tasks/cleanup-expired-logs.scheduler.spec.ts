import { LOG_CATEGORY } from '@/shared/log/constants/log.constants';
import type { ILogWriteOptions } from '@/shared/log/interfaces/log.interface';
import { LogService } from '@/shared/log/log.service';
import { CleanupExpiredLogsScheduler } from '@/modules/scheduled-tasks/cleanup-expired-logs.scheduler';
import { ConfigService } from '@nestjs/config';
import { describe, expect, it, vi } from 'vitest';

const createConfigService = () =>
  ({
    get: vi.fn((key: string) =>
      key === 'default' ? { log: { retentionDays: 30 } } : {},
    ),
  }) as unknown as ConfigService;

describe('CleanupExpiredLogsScheduler', () => {
  it('deletes records older than the configured retention boundary', async () => {
    const logs = {
      purgeBefore: vi.fn().mockResolvedValue(12),
    };
    const logger = {
      log: vi.fn<(message: string, options: ILogWriteOptions) => void>(),
    };
    const scheduler = new CleanupExpiredLogsScheduler(
      logs as unknown as LogService,
      createConfigService(),
      logger as never,
    );

    await scheduler.handleCleanup(new Date('2026-09-10T02:00:00.000Z'));

    expect(logs.purgeBefore).toHaveBeenCalledWith(
      new Date('2026-08-11T02:00:00.000Z'),
    );
    expect(logger.log).toHaveBeenCalledWith(
      'Expired logs removed',
      expect.objectContaining({
        category: LOG_CATEGORY.SCHEDULED_TASK,
        context: { deleted: 12 },
      }),
    );
  });
});
