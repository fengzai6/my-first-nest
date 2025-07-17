import { RoleCode } from '@/common/constants';
import { SpecialRolesEnum } from '@/common/decorators/special-roles.decorator';
import { Role } from '@/modules/roles/entities/role.entity';
import * as argon2 from 'argon2';
import { DataSource } from 'typeorm';
import { User } from '../../src/modules/users/entities/user.entity';

export const seedUser = async (dataSource: DataSource) => {
  // 使用环境变量或默认值
  const defaultAdminUsername = process.env.DEFAULT_ADMIN_USERNAME;

  if (!defaultAdminUsername) {
    throw new Error('DEFAULT_ADMIN_USERNAME is not set');
  }

  const defaultAdminPassword = process.env.DEFAULT_ADMIN_PASSWORD;

  const userRepository = dataSource.getRepository(User);
  const roleRepository = dataSource.getRepository(Role);

  // 获取管理员角色
  const adminRole = await roleRepository.findOne({
    where: { code: RoleCode.ADMIN },
  });

  const exist = await userRepository.findOne({
    where: { username: defaultAdminUsername },
  });

  // 对密码进行哈希处理
  const hashedPassword = await argon2.hash(defaultAdminPassword);

  const user = userRepository.create({
    username: defaultAdminUsername,
    password: hashedPassword,
    specialRoles: [SpecialRolesEnum.SuperAdmin],
    roles: [adminRole as Role],
  });

  if (!exist) {
    await userRepository.save(user);
    console.log('已插入admin用户');
  } else {
    console.log('admin用户已存在，更新插入');
    await userRepository.save({
      ...user,
      id: exist.id,
    });
  }
};
