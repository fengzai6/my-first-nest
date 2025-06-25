import { PermissionCode } from '@/common/constants';
import { DisabledEndpoint } from '@/common/decorators';
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
import { ApiBearerAuth } from '@nestjs/swagger';
import { CreatePermissionDto } from './dto/create-permission.dto';
import { UpdatePermissionDto } from './dto/update-permission.dto';
import { PermissionsService } from './permissions.service';

@ApiBearerAuth()
@Controller('permissions')
export class PermissionsController {
  constructor(private readonly permissionsService: PermissionsService) {}

  // 暂时应该不暴露创建权限的接口，权限似乎应该与程序一起发布和同步
  @DisabledEndpoint()
  @Post()
  create(@Body() createPermissionDto: CreatePermissionDto) {
    return this.permissionsService.create(createPermissionDto);
  }

  @Permission(PermissionCode.PERMISSION_READ)
  @Get()
  findAll() {
    return this.permissionsService.findAll();
  }

  @Permission(PermissionCode.PERMISSION_READ)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.permissionsService.findOne(+id);
  }

  @Permission(PermissionCode.PERMISSION_UPDATE)
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updatePermissionDto: UpdatePermissionDto,
  ) {
    return this.permissionsService.update(+id, updatePermissionDto);
  }

  @DisabledEndpoint()
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.permissionsService.remove(+id);
  }
}
