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
import { ApiBearerAuth } from '@nestjs/swagger';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { RolesService } from './roles.service';

@Controller('roles')
@UseGuards(SpecialRolesGuard)
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Permission(PermissionCode.ROLE_CREATE)
  @SpecialRoles([SpecialRolesEnum.SuperAdmin])
  @ApiBearerAuth()
  @Post()
  create(@Body() createRoleDto: CreateRoleDto) {
    return this.rolesService.create(createRoleDto);
  }

  @Permission(PermissionCode.ROLE_READ)
  @ApiBearerAuth()
  @Get()
  findAll() {
    return this.rolesService.findAll();
  }

  @Permission(PermissionCode.ROLE_READ)
  @ApiBearerAuth()
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.rolesService.findOne(+id);
  }

  @Permission(PermissionCode.ROLE_UPDATE)
  @SpecialRoles([SpecialRolesEnum.SuperAdmin])
  @ApiBearerAuth()
  @Patch(':id')
  update(@Param('id') id: string, @Body() updateRoleDto: UpdateRoleDto) {
    return this.rolesService.update(+id, updateRoleDto);
  }

  @Permission(PermissionCode.ROLE_DELETE)
  @SpecialRoles([SpecialRolesEnum.SuperAdmin])
  @ApiBearerAuth()
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.rolesService.remove(+id);
  }
}
