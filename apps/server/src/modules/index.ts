import { AuthModule } from './auth/auth.module';
import { BenchmarkModule } from './benchmark/benchmark.module';
import { CatsModule } from './cats/cats.module';
import { BackgroundTasksModule } from './background-tasks/background-tasks.module';
import { GroupsModule } from './groups/groups.module';
import { PermissionsModule } from './permissions/permissions.module';
import { RolesModule } from './roles/roles.module';
import { ScheduledTasksModule } from './scheduled-tasks/scheduled-tasks.module';
import { SocketModule } from './socket/socket.module';
import { UsersModule } from './users/users.module';

export const modules = [
  AuthModule,
  BenchmarkModule,
  CatsModule,
  BackgroundTasksModule,
  GroupsModule,
  PermissionsModule,
  RolesModule,
  ScheduledTasksModule,
  SocketModule,
  UsersModule,
];
