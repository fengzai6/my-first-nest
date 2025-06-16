import { DataSource } from 'typeorm';
import { User } from '../../src/modules/users/entities/user.entity';

export const seedUser = async (dataSource: DataSource) => {
  const initialAdminUsername = process.env.INITIAL_ADMIN_USERNAME;

  if (!initialAdminUsername) {
    throw new Error('INITIAL_ADMIN_USERNAME is not set');
  }

  const userRepository = dataSource.getRepository(User);

  const exist = await userRepository.findOne({
    where: { username: initialAdminUsername },
  });

  if (!exist) {
    const user = userRepository.create({
      username: initialAdminUsername,
      password: process.env.INITIAL_ADMIN_PASSWORD,
      // roles: [RolesEnum.Admin],
    });

    await userRepository.save(user);
    console.log('已插入admin用户');
  } else {
    console.log('admin用户已存在，跳过插入');
  }
};
