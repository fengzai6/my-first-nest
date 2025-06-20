import { DEFAULT_ROLES } from '@/common/constants';
import { Permission } from '@/modules/permissions/entities/permission.entity';
import { Role } from '@/modules/roles/entities/role.entity';
import { DataSource, In } from 'typeorm';

export const seedRoles = async (dataSource: DataSource) => {
  const roleRepository = dataSource.getRepository(Role);
  const permissionRepository = dataSource.getRepository(Permission);

  const permissions = await permissionRepository.find({
    where: {
      code: In(
        DEFAULT_ROLES.flatMap((role) => role.permissions.map((p) => p.code)),
      ),
    },
  });

  const roles = DEFAULT_ROLES.map((role) => {
    const permissionCodes = role.permissions.map(
      (permission) => permission.code,
    );

    return {
      ...role,
      permissions: permissions.filter((permission) =>
        permissionCodes.includes(permission.code),
      ),
    };
  });

  for (const role of roles) {
    const exist = await roleRepository.findOne({
      where: { code: role.code },
      relations: ['permissions'],
    });

    if (exist) {
      await roleRepository.save({
        ...exist,
        ...role,
      });
    } else {
      await roleRepository.save(role);
    }
  }
};
