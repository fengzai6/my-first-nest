import { describe, expect, it } from 'vitest';
import { matchRoles } from '@/shared/utils/roles';

describe('matchRoles', () => {
  it('should return true when any required role is owned by user', () => {
    expect(matchRoles(['admin', 'editor'], ['user', 'editor'])).toBe(true);
  });

  it('should return false when no required role is owned by user', () => {
    expect(matchRoles(['admin'], ['user', 'editor'])).toBe(false);
  });
});
