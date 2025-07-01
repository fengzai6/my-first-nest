import { User } from '@/modules/users/entities';
import { AsyncLocalStorage } from 'async_hooks';

export const userContextStorage = new AsyncLocalStorage<User>();

/**
 * 隐式获取请求上下文中的用户信息
 * 隐式获取可能导致使用不当而获取不到用户信息
 * @returns {User} 当前请求上下文中的用户信息
 */
export const useRequestUser = (): User => {
  const user = userContextStorage.getStore();

  if (!user) {
    throw new Error(
      'useRequestUser() can only be used within a request lifecycle.',
    );
  }

  delete user.roles;

  return user;
};
