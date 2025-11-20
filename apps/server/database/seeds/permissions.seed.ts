import { PERMISSIONS } from '@/common/constants';
import { Permission } from '@/modules/permissions/entities/permission.entity';
import { DataSource } from 'typeorm';

export const seedPermissions = async (dataSource: DataSource) => {
  const permissionRepository = dataSource.getRepository(Permission);

  // 检查权限是否已存在，存在则更新，不存在则创建
  for (const permission of PERMISSIONS) {
    const existingPermission = await permissionRepository.findOne({
      where: { code: permission.code },
    });

    if (existingPermission) {
      await permissionRepository.update(existingPermission.id, permission);
    } else {
      const newPermission = permissionRepository.create(permission);

      await permissionRepository.save(newPermission);
    }
  }
};
