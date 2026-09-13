import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { QueryLogDto } from '@/shared/log/dto/query-log.dto';
import { describe, expect, it } from 'vitest';

const validateUserId = async (userId: string) => {
  const dto = plainToInstance(QueryLogDto, { userId });
  return validate(dto);
};

describe('QueryLogDto', () => {
  it('accepts a valid 19-digit userId below the maximum', async () => {
    await expect(validateUserId('9000000000000000000')).resolves.toHaveLength(
      0,
    );
  });

  it('accepts the maximum PostgreSQL bigint value', async () => {
    await expect(validateUserId('9223372036854775807')).resolves.toHaveLength(
      0,
    );
  });

  it('rejects a userId above the PostgreSQL bigint range', async () => {
    await expect(
      validateUserId('9223372036854775808'),
    ).resolves.not.toHaveLength(0);
  });

  it('rejects a non-decimal userId', async () => {
    await expect(validateUserId('user-1')).resolves.not.toHaveLength(0);
  });
});
