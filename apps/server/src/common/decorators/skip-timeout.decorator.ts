import { SetMetadata } from '@nestjs/common';

export const SKIP_TIMEOUT_KEY = 'skipTimeout';

export const SkipTimeout = () => SetMetadata(SKIP_TIMEOUT_KEY, true);
