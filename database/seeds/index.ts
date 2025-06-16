import { DataSource } from 'typeorm';
import { seedUser } from './user.seed';

const seed = async (dataSource: DataSource) => {
  await seedUser(dataSource);
};

export default seed;
