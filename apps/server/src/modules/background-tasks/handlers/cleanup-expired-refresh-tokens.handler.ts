import { RefreshTokenService } from '@/modules/auth/refresh-token.service';
import { JOB_NAMES } from '@/shared/jobs/constants/job.constants';
import { JobRegistryService } from '@/shared/jobs/registry/job-registry.service';
import { IJobContext, IJobHandler } from '@/shared/jobs/types/job.types';
import { Injectable } from '@nestjs/common';

export interface ICleanupExpiredRefreshTokensResult {
  deletedCount: number;
}

@Injectable()
export class CleanupExpiredRefreshTokensHandler implements IJobHandler<
  Record<string, never>,
  ICleanupExpiredRefreshTokensResult
> {
  readonly name = JOB_NAMES.CLEANUP_EXPIRED_REFRESH_TOKENS;

  constructor(
    registry: JobRegistryService,
    private readonly refreshTokenService: RefreshTokenService,
  ) {
    registry.register(this);
  }

  async handle(
    ctx: IJobContext<Record<string, never>>,
  ): Promise<ICleanupExpiredRefreshTokensResult> {
    await ctx.updateProgress(10);
    const result = await this.refreshTokenService.cleanupExpired();
    await ctx.updateProgress(100);
    return result;
  }
}
