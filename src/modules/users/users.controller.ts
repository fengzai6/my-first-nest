import { PermissionCode } from '@/common/constants';
import { SpecialRoles, SpecialRolesEnum } from '@/common/decorators';
import { Permission } from '@/common/decorators/permission.decorator';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdatePasswordByAdminDto } from './dto/update-password';
import {
  UpdateUserDto,
  UpdateUserRolesDto,
  UpdateUserSpecialRolesDto,
} from './dto/update-user.dto';
import { UsersService } from './users.service';

@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @ApiOperation({
    summary: '创建用户 - NeedPermission',
  })
  @Permission(PermissionCode.USER_CREATE)
  @Post()
  create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  @ApiOperation({
    summary: '获取所有用户 - NeedPermission?',
  })
  @Permission(PermissionCode.USER_READ)
  @Get()
  findAll() {
    return this.usersService.findAll();
  }

  @ApiOperation({
    summary: '获取用户',
  })
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(
      { id },
      {
        roles: true,
      },
    );
  }

  @ApiOperation({
    summary: '更新用户 - NeedPermission',
  })
  @Permission(PermissionCode.USER_UPDATE)
  @Patch(':id')
  update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    return this.usersService.update(id, updateUserDto);
  }

  @ApiOperation({
    summary: '更新用户特殊角色 - NeedSpecialRoles',
  })
  @SpecialRoles([SpecialRolesEnum.SuperAdmin])
  @Patch(':id/special-roles')
  updateSpecialRoles(
    @Param('id') id: string,
    @Body() updateSpecialRolesDto: UpdateUserSpecialRolesDto,
  ) {
    return this.usersService.updateUserSpecialRoles(id, updateSpecialRolesDto);
  }

  @ApiOperation({
    summary: '更新用户角色 - NeedPermission',
  })
  @Permission(PermissionCode.USER_UPDATE)
  @Patch(':id/roles')
  updateRoles(
    @Param('id') id: string,
    @Body() updateRolesDto: UpdateUserRolesDto,
  ) {
    return this.usersService.updateUserRoles(id, updateRolesDto);
  }

  @ApiOperation({
    summary: '更新用户密码 - NeedPermission',
  })
  @Permission(PermissionCode.USER_UPDATE)
  @Patch(':id/password')
  updatePassword(
    @Param('id') id: string,
    @Body() updatePasswordDto: UpdatePasswordByAdminDto,
  ) {
    return this.usersService.updatePasswordByAdmin(id, updatePasswordDto);
  }

  @ApiOperation({
    summary: '删除用户 - NeedPermission',
  })
  @Permission(PermissionCode.USER_DELETE)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.usersService.remove(id);
  }
}
