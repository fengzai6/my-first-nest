import { describe, expect, it } from 'vitest';
import {
  isRequestUser,
  useRequestUser,
  userContextStorage,
} from '@/common/context/user-context';
import { User } from '@/modules/users/entities/user.entity';

const createUser = (id: string) => {
  const user = new User();
  user.id = id;
  return user;
};

describe('user-context', () => {
  it('should read current request user from async context', () => {
    const user = createUser('user-id');

    userContextStorage.run(user, () => {
      expect(useRequestUser()).toBe(user);
      expect(isRequestUser('user-id')).toBe(true);
      expect(isRequestUser('other-user-id')).toBe(false);
    });
  });

  it('should throw when used outside request context', () => {
    expect(() => useRequestUser()).toThrow(
      'useRequestUser() can only be used within a request lifecycle.',
    );
  });
});
