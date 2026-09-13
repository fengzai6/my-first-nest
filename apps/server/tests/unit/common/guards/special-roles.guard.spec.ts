import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  SpecialRoles,
  SpecialRolesEnum,
} from '@/common/decorators/special-roles.decorator';
import { SpecialRolesGuard } from '@/common/guards/special-roles.guard';
import { User } from '@/modules/users/entities/user.entity';

const createContext = (user?: Pick<User, 'specialRoles'>): ExecutionContext => {
  return {
    getHandler: () => createContext,
    getClass: () => createContext,
    switchToHttp: () => ({
      getRequest: () => ({
        user,
      }),
    }),
  } as unknown as ExecutionContext;
};

describe('SpecialRolesGuard', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  it('should allow request when no special role is required', () => {
    const getAllAndOverride = vi.fn().mockReturnValue(undefined);
    const reflector = {
      getAllAndOverride,
    } as unknown as Reflector;
    const guard = new SpecialRolesGuard(reflector);

    expect(guard.canActivate(createContext())).toBe(true);
    expect(getAllAndOverride).toHaveBeenCalledWith(SpecialRoles, [
      expect.any(Function),
      expect.any(Function),
    ]);
  });

  it('should deny request when user has no required special role', () => {
    const reflector = {
      getAllAndOverride: vi.fn().mockReturnValue([SpecialRolesEnum.SuperAdmin]),
    } as unknown as Reflector;
    const guard = new SpecialRolesGuard(reflector);

    expect(
      guard.canActivate(
        createContext({ specialRoles: [SpecialRolesEnum.Developer] }),
      ),
    ).toBe(false);
  });

  it('should allow request when user has required special role', () => {
    const reflector = {
      getAllAndOverride: vi.fn().mockReturnValue([SpecialRolesEnum.SuperAdmin]),
    } as unknown as Reflector;
    const guard = new SpecialRolesGuard(reflector);

    expect(
      guard.canActivate(
        createContext({ specialRoles: [SpecialRolesEnum.SuperAdmin] }),
      ),
    ).toBe(true);
  });

  it('should allow controller-level special roles', () => {
    const reflector = {
      getAllAndOverride: vi.fn().mockReturnValue([SpecialRolesEnum.Developer]),
    } as unknown as Reflector;
    const guard = new SpecialRolesGuard(reflector);

    expect(
      guard.canActivate(
        createContext({ specialRoles: [SpecialRolesEnum.Developer] }),
      ),
    ).toBe(true);
  });
});
