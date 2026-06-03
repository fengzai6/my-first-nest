import {
  PermissionCode,
  PermissionCodeType,
} from '@/common/constants/permissions';
import { ErrorExceptionCode } from '@/common/exceptions/error.exception';
import { Permission } from '@/modules/permissions/entities/permission.entity';
import { PermissionsService } from '@/modules/permissions/permissions.service';
import { Role } from '@/modules/roles/entities/role.entity';
import { RolesService } from '@/modules/roles/roles.service';
import { beforeEach, describe, expect, it, MockInstance, vi } from 'vitest';

type MockRepository = {
  create: MockInstance<(value: Partial<Role>) => Role>;
  find: MockInstance<(criteria?: unknown) => Promise<Role[]>>;
  findOne: MockInstance<(criteria: unknown) => Promise<Role | null>>;
  merge: MockInstance<(target: Role, source: Partial<Role>) => Role>;
  save: MockInstance<(value: Role) => Promise<Role>>;
  softDelete: MockInstance<(id: string) => Promise<{ affected: number }>>;
};

type MockPermissionsService = {
  findByCodes: MockInstance<
    (codes: PermissionCodeType[]) => Promise<Permission[]>
  >;
};

const createPermission = (
  code: PermissionCodeType = PermissionCode.USER_READ,
) => {
  const permission = new Permission();
  permission.id = `${code}-id`;
  permission.code = code;
  permission.name = code;
  return permission;
};

const createRole = ({
  id = 'role-id',
  name = 'Admin',
  code = 'admin',
  permissions = [createPermission()],
}: Partial<Role> = {}) => {
  const role = new Role();
  role.id = id;
  role.name = name;
  role.code = code;
  role.permissions = permissions;
  return role;
};

const createRepository = (): MockRepository => ({
  create: vi.fn((value: Partial<Role>) => Object.assign(new Role(), value)),
  find: vi.fn(),
  findOne: vi.fn(),
  merge: vi.fn((target: Role, source: Partial<Role>) =>
    Object.assign(target, source),
  ),
  save: vi.fn((value: Role) => Promise.resolve(value)),
  softDelete: vi.fn(() => Promise.resolve({ affected: 1 })),
});

const createService = () => {
  const repository = createRepository();
  const permissionsService: MockPermissionsService = {
    findByCodes: vi.fn(),
  };

  return {
    repository,
    permissionsService,
    service: new RolesService(
      repository as never,
      permissionsService as unknown as PermissionsService,
    ),
  };
};

describe('RolesService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create role with resolved permissions', async () => {
    const { service, repository, permissionsService } = createService();
    const permissions = [createPermission(PermissionCode.USER_READ)];

    permissionsService.findByCodes.mockResolvedValue(permissions);

    const result = await service.create({
      name: 'Admin',
      description: 'Admin role',
      code: 'admin',
      permissions: [PermissionCode.USER_READ],
    });

    expect(permissionsService.findByCodes).toHaveBeenCalledWith([
      PermissionCode.USER_READ,
    ]);
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Admin',
        code: 'admin',
        permissions,
      }),
    );
    expect(result.permissions).toBe(permissions);
  });

  it('should find roles by codes', async () => {
    const { service, repository } = createService();
    const roles = [createRole()];

    repository.find.mockResolvedValue(roles);

    await expect(service.findByCodes(['admin'])).resolves.toBe(roles);
    const findCriteria = repository.find.mock.calls[0]?.[0] as {
      where: { code: unknown };
    };

    expect(findCriteria.where.code).toMatchObject({
      _type: 'in',
      _value: ['admin'],
    });
  });

  it('should find roles by user id', async () => {
    const { service, repository } = createService();
    const roles = [createRole()];

    repository.find.mockResolvedValue(roles);

    await expect(service.findByUser('user-id')).resolves.toBe(roles);
    expect(repository.find).toHaveBeenCalledWith({
      where: {
        users: {
          id: 'user-id',
        },
      },
    });
  });

  it('should find all roles with permissions', async () => {
    const { service, repository } = createService();
    const roles = [createRole()];

    repository.find.mockResolvedValue(roles);

    await expect(service.findAll()).resolves.toBe(roles);
    expect(repository.find).toHaveBeenCalledWith({
      relations: {
        permissions: true,
      },
    });
  });

  it('should update role and replace permissions when provided', async () => {
    const { service, repository, permissionsService } = createService();
    const role = createRole();
    const permissions = [createPermission(PermissionCode.USER_UPDATE)];

    repository.findOne.mockResolvedValue(role);
    permissionsService.findByCodes.mockResolvedValue(permissions);

    const result = await service.update('role-id', {
      name: 'Manager',
      permissions: [PermissionCode.USER_UPDATE],
    });

    expect(permissionsService.findByCodes).toHaveBeenCalledWith([
      PermissionCode.USER_UPDATE,
    ]);
    expect(repository.merge).toHaveBeenCalledWith(role, {
      name: 'Manager',
      permissions,
    });
    expect(result.permissions).toBe(permissions);
  });

  it('should keep existing permissions when update omits permissions', async () => {
    const { service, repository, permissionsService } = createService();
    const role = createRole();

    repository.findOne.mockResolvedValue(role);

    await service.update('role-id', { name: 'Manager' });

    expect(permissionsService.findByCodes).not.toHaveBeenCalled();
    expect(repository.merge).toHaveBeenCalledWith(role, {
      name: 'Manager',
      permissions: role.permissions,
    });
  });

  it('should throw when updating missing role', async () => {
    const { service, repository } = createService();

    repository.findOne.mockResolvedValue(null);

    await expect(
      service.update('missing-id', { name: 'Missing' }),
    ).rejects.toMatchObject({
      code: ErrorExceptionCode.ROLE_NOT_FOUND,
    });
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('should soft delete existing role', async () => {
    const { service, repository } = createService();

    repository.findOne.mockResolvedValue(createRole());

    await expect(service.remove('role-id')).resolves.toEqual({ affected: 1 });
    expect(repository.softDelete).toHaveBeenCalledWith('role-id');
  });

  it('should throw when deleting missing role', async () => {
    const { service, repository } = createService();

    repository.findOne.mockResolvedValue(null);

    await expect(service.remove('missing-id')).rejects.toMatchObject({
      code: ErrorExceptionCode.ROLE_NOT_FOUND,
    });
    expect(repository.softDelete).not.toHaveBeenCalled();
  });
});
