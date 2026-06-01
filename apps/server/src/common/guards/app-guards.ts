import { APP_GUARD } from '@nestjs/core';
import { JwtAuthGuard } from './jwt-auth.guard';
import { PermissionGuard } from './permission.guard';
import { AppThrottlerGuard } from '@/shared/throttler/throttler.guard';

export const appGuards = [
  {
    provide: APP_GUARD,
    useClass: JwtAuthGuard,
  },
  {
    provide: APP_GUARD,
    useClass: PermissionGuard,
  },
  {
    provide: APP_GUARD,
    useClass: AppThrottlerGuard,
  },
];
