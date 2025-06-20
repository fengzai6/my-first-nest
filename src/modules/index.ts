import { AuthModule } from './auth/auth.module';
import { CatsModule } from './cats/cats.module';
import { GroupsModule } from './groups/groups.module';
import { PermissionsModule } from './permissions/permissions.module';
import { RolesModule } from './roles/roles.module';
import { UsersModule } from './users/users.module';

export const modules = [
  AuthModule,
  CatsModule,
  GroupsModule,
  PermissionsModule,
  RolesModule,
  UsersModule,
];
