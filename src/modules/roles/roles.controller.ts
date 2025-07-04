import { PermissionCode } from '@/common/constants';
import { Permission } from '@/common/decorators/permission.decorator';
import {
  SpecialRoles,
  SpecialRolesEnum,
} from '@/common/decorators/special-roles.decorator';
import { SpecialRolesGuard } from '@/common/guards/special-roles.guard';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { RolesService } from './roles.service';

@ApiBearerAuth()
@Controller('roles')
@UseGuards(SpecialRolesGuard)
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @ApiOperation({
    summary: '创建角色',
  })
  @Permission(PermissionCode.ROLE_CREATE)
  @SpecialRoles([SpecialRolesEnum.SuperAdmin])
  @Post()
  create(@Body() createRoleDto: CreateRoleDto) {
    return this.rolesService.create(createRoleDto);
  }

  @ApiOperation({
    summary: '获取所有角色',
  })
  @Permission(PermissionCode.ROLE_READ)
  @Get()
  findAll() {
    return this.rolesService.findAll();
  }

  @ApiOperation({
    summary: '获取角色',
  })
  @Permission(PermissionCode.ROLE_READ)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.rolesService.findOne(id);
  }

  @ApiOperation({
    summary: '更新角色',
  })
  @Permission(PermissionCode.ROLE_UPDATE)
  @SpecialRoles([SpecialRolesEnum.SuperAdmin])
  @Patch(':id')
  update(@Param('id') id: string, @Body() updateRoleDto: UpdateRoleDto) {
    return this.rolesService.update(id, updateRoleDto);
  }

  @ApiOperation({
    summary: '删除角色',
  })
  @Permission(PermissionCode.ROLE_DELETE)
  @SpecialRoles([SpecialRolesEnum.SuperAdmin])
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.rolesService.remove(id);
  }
}
