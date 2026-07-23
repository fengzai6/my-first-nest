import { AuthModule } from './auth/auth.module';
import { BenchmarkModule } from './benchmark/benchmark.module';
import { CatsModule } from './cats/cats.module';
import { DemoJobsModule } from './demo-jobs/demo-jobs.module';
import { GroupsModule } from './groups/groups.module';
import { PermissionsModule } from './permissions/permissions.module';
import { RolesModule } from './roles/roles.module';
import { ScheduleDemoModule } from './schedule-demo/schedule-demo.module';
import { SocketModule } from './socket/socket.module';
import { UsersModule } from './users/users.module';

export const modules = [
  AuthModule,
  BenchmarkModule,
  CatsModule,
  DemoJobsModule,
  GroupsModule,
  PermissionsModule,
  RolesModule,
  ScheduleDemoModule,
  SocketModule,
  UsersModule,
];
