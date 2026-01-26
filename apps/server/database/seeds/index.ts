import { DataSource } from 'typeorm';
import { seedPermissions } from './permissions.seed';
import { seedRoles } from './roles.seed';
import { seedUser } from './user.seed';

const seed = async (dataSource: DataSource) => {
  await seedPermissions(dataSource);
  await seedRoles(dataSource);
  await seedUser(dataSource);
};

export default seed;
