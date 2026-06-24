import { PermissionCode } from '@/common/constants/permissions';
import { ErrorExceptionCode } from '@/common/exceptions/error.exception';
import { Permission } from '@/modules/permissions/entities/permission.entity';
import { PermissionsService } from '@/modules/permissions/permissions.service';
import { beforeEach, describe, expect, it, MockInstance, vi } from 'vitest';

type MockRepository = {
  create: MockInstance<(value: Partial<Permission>) => Permission>;
  find: MockInstance<(criteria?: unknown) => Promise<Permission[]>>;
  findOneBy: MockInstance<
    (value: { id: string }) => Promise<Permission | null>
  >;
  merge: MockInstance<
    (target: Permission, source: Partial<Permission>) => Permission
  >;
  save: MockInstance<(value: Permission) => Promise<Permission>>;
  softDelete: MockInstance<(id: string) => Promise<{ affected: number }>>;
};

const createPermission = ({
  id = 'permission-id',
  name = 'User Read',
  code = PermissionCode.USER_READ,
  description = 'Read users',
}: Partial<Permission> = {}) => {
  const permission = new Permission();
  permission.id = id;
  permission.name = name;
  permission.code = code;
  permission.description = description;
  return permission;
};

const createRepository = (): MockRepository => ({
  create: vi.fn((value: Partial<Permission>) =>
    Object.assign(new Permission(), value),
  ),
  find: vi.fn(),
  findOneBy: vi.fn(),
  merge: vi.fn((target: Permission, source: Partial<Permission>) =>
    Object.assign(target, source),
  ),
  save: vi.fn((value: Permission) => Promise.resolve(value)),
  softDelete: vi.fn(() => Promise.resolve({ affected: 1 })),
});

const createService = () => {
  const repository = createRepository();

  return {
    repository,
    service: new PermissionsService(repository as never),
  };
};

describe('PermissionsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create permission from dto', async () => {
    const { service, repository } = createService();
    const dto = {
      name: 'User Read',
      code: PermissionCode.USER_READ,
      description: 'Read users',
    };

    const result = await service.create(dto);

    expect(repository.create).toHaveBeenCalledWith(dto);
    expect(repository.save).toHaveBeenCalledWith(expect.any(Permission));
    expect(result).toMatchObject(dto);
  });

  it('should find permissions by codes', async () => {
    const { service, repository } = createService();
    const permissions = [createPermission()];

    repository.find.mockResolvedValue(permissions);

    await expect(service.findByCodes([PermissionCode.USER_READ])).resolves.toBe(
      permissions,
    );
    const findCriteria = repository.find.mock.calls[0]?.[0] as {
      where: { code: unknown };
    };

    expect(findCriteria.where.code).toMatchObject({
      _type: 'in',
      _value: [PermissionCode.USER_READ],
    });
  });

  it('should pass through findMany criteria', async () => {
    const { service, repository } = createService();
    const permissions = [createPermission()];
    const criteria = {
      where: {
        roles: {
          id: 'role-id',
        },
      },
    };

    repository.find.mockResolvedValue(permissions);

    await expect(service.findMany(criteria)).resolves.toBe(permissions);
    expect(repository.find).toHaveBeenCalledWith(criteria);
  });

  it('should update existing permission', async () => {
    const { service, repository } = createService();
    const permission = createPermission();

    repository.findOneBy.mockResolvedValue(permission);

    const result = await service.update('permission-id', {
      name: 'Users Read',
    });

    expect(repository.merge).toHaveBeenCalledWith(permission, {
      name: 'Users Read',
    });
    expect(result.name).toBe('Users Read');
  });

  it('should throw when updating missing permission', async () => {
    const { service, repository } = createService();

    repository.findOneBy.mockResolvedValue(null);

    await expect(
      service.update('missing-id', { name: 'Missing' }),
    ).rejects.toMatchObject({
      code: ErrorExceptionCode.PERMISSION_NOT_FOUND,
    });
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('should soft delete existing permission', async () => {
    const { service, repository } = createService();

    repository.findOneBy.mockResolvedValue(createPermission());

    await expect(service.remove('permission-id')).resolves.toEqual({
      affected: 1,
    });
    expect(repository.softDelete).toHaveBeenCalledWith('permission-id');
  });

  it('should throw when deleting missing permission', async () => {
    const { service, repository } = createService();

    repository.findOneBy.mockResolvedValue(null);

    await expect(service.remove('missing-id')).rejects.toMatchObject({
      code: ErrorExceptionCode.PERMISSION_NOT_FOUND,
    });
    expect(repository.softDelete).not.toHaveBeenCalled();
  });
});
