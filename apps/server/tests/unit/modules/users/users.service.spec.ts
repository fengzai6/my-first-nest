import { ConfigService } from '@nestjs/config';
import { beforeEach, describe, expect, it, vi, MockInstance } from 'vitest';
import { userContextStorage } from '@/common/context/user-context';
import { RoleCode } from '@/common/constants/roles';
import { SpecialRolesEnum } from '@/common/decorators/special-roles.decorator';
import { ErrorExceptionCode } from '@/common/exceptions/error.exception';
import { Permission } from '@/modules/permissions/entities/permission.entity';
import { PermissionsService } from '@/modules/permissions/permissions.service';
import { Role } from '@/modules/roles/entities/role.entity';
import { RolesService } from '@/modules/roles/roles.service';
import { User } from '@/modules/users/entities/user.entity';
import { UsersService } from '@/modules/users/users.service';

vi.mock('argon2', () => ({
  hash: vi.fn((value: string) => Promise.resolve(`hashed:${value}`)),
  verify: vi.fn((hashValue: string, value: string) =>
    Promise.resolve(hashValue === `hashed:${value}`),
  ),
}));

type MockRepository = {
  create: MockInstance<(value: Partial<User>) => Partial<User>>;
  exists: MockInstance<() => Promise<boolean>>;
  findAndCount: MockInstance<() => Promise<[User[], number]>>;
  findOne: MockInstance<() => Promise<User | null>>;
  merge: MockInstance<(target: User, source: Partial<User>) => User>;
  save: MockInstance<
    (value: User | Partial<User>) => Promise<User | Partial<User>>
  >;
  softRemove: MockInstance<(value: User) => Promise<User>>;
  update: MockInstance<() => Promise<{ affected: number }>>;
};

const createUser = ({
  id = 'user-id',
  username = 'fengzai',
  email = 'test@test.com',
  password = 'hashed:old-password',
  specialRoles = [],
}: Partial<User> = {}) => {
  const user = new User();
  user.id = id;
  user.username = username;
  user.email = email;
  user.password = password;
  user.specialRoles = specialRoles;
  return user;
};

const createRole = (code: string) => {
  const role = new Role();
  role.id = `${code}-id`;
  role.code = code;
  role.name = code;
  return role;
};

const createPermission = (code: Permission['code']) => {
  const permission = new Permission();
  permission.id = `${code}-id`;
  permission.code = code;
  permission.name = code;
  return permission;
};

const createRepository = (): MockRepository => ({
  create: vi.fn((value: Partial<User>) => value),
  exists: vi.fn(),
  findAndCount: vi.fn(),
  findOne: vi.fn(),
  merge: vi.fn((target: User, source: Partial<User>) =>
    Object.assign(target, source),
  ),
  save: vi.fn((value: User | Partial<User>) => Promise.resolve(value)),
  softRemove: vi.fn((value: User) => Promise.resolve(value)),
  update: vi.fn(() => Promise.resolve({ affected: 1 })),
});

const createService = () => {
  const repository = createRepository();
  const findByCodes = vi.fn();
  const findByUser = vi.fn();
  const findMany = vi.fn();
  const rolesService = {
    findByCodes,
    findByUser,
  } as unknown as RolesService;
  const permissionsService = {
    findMany,
  } as unknown as PermissionsService;
  const configService = {
    get: vi.fn((key: string) => {
      if (key === 'DEFAULT_ADMIN_USERNAME') {
        return 'admin';
      }
      return undefined;
    }),
  } as unknown as ConfigService;

  return {
    repository,
    rolesService,
    permissionsService,
    configService,
    findByCodes,
    findByUser,
    findMany,
    service: new UsersService(
      repository as never,
      rolesService,
      permissionsService,
      configService,
    ),
  };
};

describe('UsersService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create user with hashed password and resolved roles', async () => {
    const { repository, findByCodes, service } = createService();
    const roles = [createRole(RoleCode.ADMIN)];

    repository.exists.mockResolvedValue(false);
    findByCodes.mockResolvedValue(roles);

    const result = await service.create({
      username: 'fengzai',
      email: 'test@test.com',
      password: 'password123',
      roles: [RoleCode.ADMIN],
    });

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        username: 'fengzai',
        email: 'test@test.com',
        password: 'hashed:password123',
        roles,
      }),
    );
    expect(repository.save).toHaveBeenCalledTimes(1);
    expect(result.password).toBe('hashed:password123');
  });

  it('should reject duplicated username or email when creating user', async () => {
    const { repository, service } = createService();

    repository.exists.mockResolvedValue(true);

    await expect(
      service.create({
        username: 'fengzai',
        email: 'test@test.com',
        password: 'password123',
      }),
    ).rejects.toMatchObject({
      code: ErrorExceptionCode.USER_ALREADY_EXISTS,
    });
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('should find paginated users with search conditions', async () => {
    const { repository, service } = createService();
    const user = createUser();

    repository.findAndCount.mockResolvedValue([[user], 1]);

    const result = await service.findAll({
      page: 2,
      pageSize: 10,
      search: 'feng',
    });

    expect(repository.findAndCount).toHaveBeenCalledWith(
      expect.objectContaining({
        relations: { roles: true },
        skip: 10,
        take: 10,
        order: { createdAt: 'DESC' },
      }),
    );
    expect(result).toEqual({ list: [user], total: 1, page: 2, pageSize: 10 });
  });

  it('should throw when user is not found', async () => {
    const { repository, service } = createService();

    repository.findOne.mockResolvedValue(null);

    await expect(service.findOne({ id: 'missing-id' })).rejects.toMatchObject({
      code: ErrorExceptionCode.USER_NOT_FOUND,
    });
  });

  it('should remove username update for default admin user', async () => {
    const { repository, service } = createService();
    const admin = createUser({ username: 'admin' });

    repository.findOne.mockResolvedValue(admin);

    const result = await service.update('admin-id', {
      username: 'new-admin',
      nickname: 'Admin',
    });

    expect(repository.exists).not.toHaveBeenCalled();
    expect(repository.merge).toHaveBeenCalledWith(admin, { nickname: 'Admin' });
    expect(result.username).toBe('admin');
    expect(result.nickname).toBe('Admin');
  });

  it('should reject update when new username or email already exists', async () => {
    const { repository, service } = createService();

    repository.findOne.mockResolvedValue(createUser());
    repository.exists.mockResolvedValue(true);

    await expect(
      service.update('user-id', { username: 'other-user' }),
    ).rejects.toMatchObject({
      code: ErrorExceptionCode.USER_ALREADY_EXISTS,
    });
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('should update user roles from role codes', async () => {
    const { repository, findByCodes, service } = createService();
    const user = createUser();
    const roles = [createRole(RoleCode.USER)];

    repository.findOne.mockResolvedValue(user);
    findByCodes.mockResolvedValue(roles);

    const result = await service.updateUserRoles('user-id', {
      roles: [RoleCode.USER],
    });

    expect(findByCodes).toHaveBeenCalledWith([RoleCode.USER]);
    expect(repository.merge).toHaveBeenCalledWith(user, { roles });
    expect(result.roles).toBe(roles);
  });

  it('should prevent self special role update for non-default admin user', async () => {
    const { repository, service } = createService();
    const user = createUser({ id: 'user-id', username: 'fengzai' });

    repository.findOne.mockResolvedValue(user);

    await userContextStorage.run(user, async () => {
      await expect(
        service.updateUserSpecialRoles('user-id', {
          roles: [SpecialRolesEnum.Developer],
        }),
      ).rejects.toMatchObject({
        code: ErrorExceptionCode.SUPER_ADMIN_IS_SPECIAL,
      });
    });
  });

  it('should return permissions for current user roles', async () => {
    const { findByUser, findMany, service } = createService();
    const user = createUser({ id: 'user-id' });
    const roles = [createRole(RoleCode.ADMIN)];
    const permissions = [createPermission('user:read')];

    findByUser.mockResolvedValue(roles);
    findMany.mockResolvedValue(permissions);

    await userContextStorage.run(user, async () => {
      await expect(service.getPermissions()).resolves.toBe(permissions);
    });
    expect(findByUser).toHaveBeenCalledWith('user-id');
    expect(findMany).toHaveBeenCalledTimes(1);
    expect(findMany.mock.calls[0]?.[0]).toHaveProperty('where.roles.id');
  });

  it('should reject password update when old password is invalid', async () => {
    const { repository, service } = createService();

    repository.findOne.mockResolvedValue(createUser());

    await userContextStorage.run(createUser(), async () => {
      await expect(
        service.updatePassword({
          oldPassword: 'wrong-password',
          newPassword: 'new-password',
        }),
      ).rejects.toMatchObject({
        code: ErrorExceptionCode.INVALID_CREDENTIALS,
      });
    });
    expect(repository.update).not.toHaveBeenCalled();
  });

  it('should reject password update when new password equals old password', async () => {
    const { repository, service } = createService();

    repository.findOne.mockResolvedValue(createUser());

    await userContextStorage.run(createUser(), async () => {
      await expect(
        service.updatePassword({
          oldPassword: 'old-password',
          newPassword: 'old-password',
        }),
      ).rejects.toMatchObject({
        code: ErrorExceptionCode.NEW_PASSWORD_SAME_AS_OLD,
      });
    });
    expect(repository.update).not.toHaveBeenCalled();
  });

  it('should update password when old password is valid', async () => {
    const { repository, service } = createService();

    repository.findOne.mockResolvedValue(createUser());

    await userContextStorage.run(createUser(), async () => {
      const response = await service.updatePassword({
        oldPassword: 'old-password',
        newPassword: 'new-password',
      });

      expect(repository.update).toHaveBeenCalledWith('user-id', {
        password: 'hashed:new-password',
      });
      expect(response.message).toBe('Password updated successfully');
    });
  });

  it('should update password by admin after checking user exists', async () => {
    const { repository, service } = createService();

    repository.findOne.mockResolvedValue(createUser());

    const response = await service.updatePasswordByAdmin('user-id', {
      newPassword: 'new-password',
    });

    expect(repository.findOne).toHaveBeenCalledWith({
      where: { id: 'user-id' },
      relations: undefined,
    });
    expect(repository.update).toHaveBeenCalledWith('user-id', {
      password: 'hashed:new-password',
    });
    expect(response.message).toBe('Password updated successfully');
  });

  it('should prevent removing super admin user', async () => {
    const { repository, service } = createService();

    repository.findOne.mockResolvedValue(
      createUser({ specialRoles: [SpecialRolesEnum.SuperAdmin] }),
    );

    await expect(service.remove('user-id')).rejects.toMatchObject({
      code: ErrorExceptionCode.SUPER_ADMIN_IS_SPECIAL,
    });
    expect(repository.softRemove).not.toHaveBeenCalled();
  });

  it('should soft remove normal user', async () => {
    const { repository, service } = createService();
    const user = createUser();

    repository.findOne.mockResolvedValue(user);

    await expect(service.remove('user-id')).resolves.toBe(user);
    expect(repository.softRemove).toHaveBeenCalledWith(user);
  });
});
