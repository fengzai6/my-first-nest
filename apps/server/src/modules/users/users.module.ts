import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PermissionsModule } from '../permissions/permissions.module';
import { RolesModule } from '../roles/roles.module';
import { AccountController } from './account.controller';
import { User } from './entities/user.entity';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [TypeOrmModule.forFeature([User]), RolesModule, PermissionsModule],
  controllers: [UsersController, AccountController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
