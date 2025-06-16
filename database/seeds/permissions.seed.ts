import { Permission } from '@/modules/permissions/entities/permission.entity';
import { DataSource } from 'typeorm';

export const seedPermissions = async (dataSource: DataSource) => {
  const permissionRepository = dataSource.getRepository(Permission);

  const exist = await permissionRepository.findOne({
    where: { name: 'admin' },
  });
};
