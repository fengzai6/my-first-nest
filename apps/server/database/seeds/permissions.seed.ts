import { PERMISSIONS } from '@/common/constants/permissions';
import { Permission } from '@/modules/permissions/entities/permission.entity';
import { DataSource } from 'typeorm';

export const seedPermissions = async (dataSource: DataSource) => {
  const permissionRepository = dataSource.getRepository(Permission);

  for (const permission of PERMISSIONS) {
    const existing = await permissionRepository.findOne({
      where: { code: permission.code },
    });

    if (existing) {
      await permissionRepository.update(existing.id, permission);
    } else {
      const entity = permissionRepository.create(permission);
      await permissionRepository.save(entity);
    }
  }
};
