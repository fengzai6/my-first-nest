import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GroupMemberRolesEnum } from '@/common/decorators/group-member-roles.decorator';
import { Permission } from '@/common/decorators/permission.decorator';
import { SpecialRolesEnum } from '@/common/decorators/special-roles.decorator';
import { PermissionCode } from '@/common/constants/permissions';
import { PermissionGuard } from '@/common/guards/permission.guard';
import { GroupsService } from '@/modules/groups/groups.service';
import { User } from '@/modules/users/entities/user.entity';
import { UsersService } from '@/modules/users/users.service';

type RequestShape = {
  user?: User;
  params?: {
    groupId?: string;
  };
  body?: {
    parentId?: string;
  };
};

const createUser = (id: string, specialRoles: SpecialRolesEnum[] = []) => {
  const user = new User();
  user.id = id;
  user.specialRoles = specialRoles;
  return user;
};

const createContext = (request: RequestShape): ExecutionContext => {
  return {
    getHandler: () => createContext,
    switchToHttp: () => ({
      getRequest: () => ({
        params: {},
        body: {},
        ...request,
      }),
    }),
  } as unknown as ExecutionContext;
};

const createGuard = ({
  requiredPermission,
  requiredGroupRoles,
  userPermissions = [],
  groupMemberRole,
}: {
  requiredPermission?: string;
  requiredGroupRoles?: GroupMemberRolesEnum[];
  userPermissions?: string[];
  groupMemberRole?: GroupMemberRolesEnum | null;
}) => {
  const reflector = {
    get: vi.fn((decorator: unknown) => {
      if (decorator === Permission) {
        return requiredPermission;
      }
      return requiredGroupRoles;
    }),
  } as unknown as Reflector;
  const getGroupMemberRole = vi.fn().mockResolvedValue(groupMemberRole);
  const getPermissions = vi.fn().mockResolvedValue(
    userPermissions.map((code) => ({
      code,
    })),
  );
  const groupsService = {
    getGroupMemberRole,
  } as unknown as GroupsService;
  const usersService = {
    getPermissions,
  } as unknown as UsersService;

  return {
    guard: new PermissionGuard(reflector, groupsService, usersService),
    getGroupMemberRole,
    getPermissions,
  };
};

describe('PermissionGuard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should allow request when no permission is required', async () => {
    const { guard, getPermissions } = createGuard({});

    await expect(guard.canActivate(createContext({}))).resolves.toBe(true);
    expect(getPermissions).not.toHaveBeenCalled();
  });

  it('should allow super admin without querying permissions', async () => {
    const { guard, getPermissions } = createGuard({
      requiredPermission: PermissionCode.USER_READ,
    });

    await expect(
      guard.canActivate(
        createContext({
          user: createUser('user-id', [SpecialRolesEnum.SuperAdmin]),
        }),
      ),
    ).resolves.toBe(true);
    expect(getPermissions).not.toHaveBeenCalled();
  });

  it('should deny request when permission is required but user is missing', async () => {
    const { guard } = createGuard({
      requiredPermission: PermissionCode.USER_READ,
    });

    await expect(guard.canActivate(createContext({}))).resolves.toBe(false);
  });

  it('should allow request when user has required permission', async () => {
    const { guard } = createGuard({
      requiredPermission: PermissionCode.USER_READ,
      userPermissions: [PermissionCode.USER_READ],
    });

    await expect(
      guard.canActivate(
        createContext({
          user: createUser('user-id'),
        }),
      ),
    ).resolves.toBe(true);
  });

  it('should allow leader when group role requires leader', async () => {
    const { guard, getGroupMemberRole } = createGuard({
      requiredPermission: PermissionCode.USER_READ,
      requiredGroupRoles: [GroupMemberRolesEnum.Leader],
      groupMemberRole: GroupMemberRolesEnum.SuperiorLeader,
    });

    await expect(
      guard.canActivate(
        createContext({
          user: createUser('user-id'),
          params: {
            groupId: 'group-id',
          },
        }),
      ),
    ).resolves.toBe(true);
    expect(getGroupMemberRole).toHaveBeenCalledWith('group-id', 'user-id');
  });

  it('should deny request when group member role is missing', async () => {
    const { guard } = createGuard({
      requiredPermission: PermissionCode.USER_READ,
      requiredGroupRoles: [GroupMemberRolesEnum.Member],
      groupMemberRole: null,
    });

    await expect(
      guard.canActivate(
        createContext({
          user: createUser('user-id'),
          body: {
            parentId: 'group-id',
          },
        }),
      ),
    ).resolves.toBe(false);
  });
});
