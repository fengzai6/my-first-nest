import { AuthModule } from './auth/auth.module';
import { BenchmarkModule } from './benchmark/benchmark.module';
import { CatsModule } from './cats/cats.module';
import { GroupsModule } from './groups/groups.module';
import { PermissionsModule } from './permissions/permissions.module';
import { RolesModule } from './roles/roles.module';
import { SocketModule } from './socket/socket.module';
import { UsersModule } from './users/users.module';

export const modules = [
  AuthModule,
  BenchmarkModule,
  CatsModule,
  GroupsModule,
  PermissionsModule,
  RolesModule,
  SocketModule,
  UsersModule,
];
