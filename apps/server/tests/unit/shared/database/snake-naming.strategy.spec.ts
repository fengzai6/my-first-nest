import { describe, expect, it } from 'vitest';
import { SnakeNamingStrategy } from '@/shared/database/snake-naming.strategy';

describe('SnakeNamingStrategy', () => {
  it('should convert camelCase property name to snake_case column name', () => {
    const strategy = new SnakeNamingStrategy();

    expect(strategy.columnName('createdAt')).toBe('created_at');
    expect(strategy.columnName('userProfileId')).toBe('user_profile_id');
  });
});
