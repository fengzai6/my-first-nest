import { describe, expect, it } from 'vitest';
import { User } from '@/modules/users/entities/user.entity';

describe('User', () => {
  it('should use nickname as display name when nickname exists', () => {
    const user = new User();

    user.username = 'fengzai';
    user.nickname = 'Feng Zai';

    expect(user.displayName).toBe('Feng Zai');
  });

  it('should fall back to username as display name', () => {
    const user = new User();

    user.username = 'fengzai';
    user.nickname = '';

    expect(user.displayName).toBe('fengzai');
  });
});
