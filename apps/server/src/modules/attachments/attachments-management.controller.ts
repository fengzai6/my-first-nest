import { PermissionCode } from '@/common/constants/permissions';
import { UserInfo } from '@/common/decorators/jwt-auth.decorator';
import { Permission } from '@/common/decorators/permission.decorator';
import { User } from '@/modules/users/entities/user.entity';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { BulkSoftDeleteDto } from './dto/bulk-soft-delete.dto';
import { BulkVisibilityDto } from './dto/bulk-visibility.dto';
import { FindManagementAttachmentsDto } from './dto/find-management-attachments.dto';
import { UpdateManagementVisibilityDto } from './dto/update-management-visibility.dto';
import { AttachmentsManagementPermissionGuard } from './attachments-management-permission.guard';
import { AttachmentManagementService } from './services/attachment-management.service';

@ApiTags('Attachments Management - 附件管理')
@ApiBearerAuth()
@Controller('attachments/management')
@UseGuards(AttachmentsManagementPermissionGuard)
export class AttachmentsManagementController {
  constructor(
    private readonly attachmentManagementService: AttachmentManagementService,
  ) {}

  @Get()
  @Permission(PermissionCode.ATTACHMENT_READ)
  @ApiOperation({ summary: '分页查询附件管理列表' })
  findAll(@Query() query: FindManagementAttachmentsDto) {
    return this.attachmentManagementService.findAll(query);
  }

  @Post('cleanup')
  @Permission(PermissionCode.ATTACHMENT_MANAGE)
  @ApiOperation({ summary: '手动触发附件物理清理' })
  triggerCleanup(@UserInfo() user: User) {
    return this.attachmentManagementService.triggerCleanup(user);
  }

  @Get('cleanup/latest')
  @Permission(PermissionCode.ATTACHMENT_READ)
  @ApiOperation({ summary: '查询最近一次附件清理任务' })
  getLatestCleanup() {
    return this.attachmentManagementService.getLatestCleanup();
  }

  @Get(':id/signed-url')
  @Permission(PermissionCode.ATTACHMENT_READ)
  @ApiOperation({ summary: '获取管理员附件签名 URL' })
  getSignedUrl(@Param('id') id: string, @UserInfo() user: User) {
    return this.attachmentManagementService.createSignedUrl(id, user);
  }

  @Get(':id')
  @Permission(PermissionCode.ATTACHMENT_READ)
  @ApiOperation({ summary: '查询附件管理详情' })
  findOne(@Param('id') id: string) {
    return this.attachmentManagementService.findOne(id);
  }

  @Patch('bulk/visibility')
  @Permission(PermissionCode.ATTACHMENT_MANAGE)
  @ApiOperation({ summary: '批量修改附件可见性' })
  bulkUpdateVisibility(@Body() dto: BulkVisibilityDto) {
    return this.attachmentManagementService.bulkUpdateVisibility(
      dto.ids,
      dto.visibility,
    );
  }

  @Post('bulk/soft-delete')
  @HttpCode(HttpStatus.OK)
  @Permission(PermissionCode.ATTACHMENT_MANAGE)
  @ApiOperation({ summary: '批量软删除未绑定附件' })
  bulkSoftDelete(@Body() dto: BulkSoftDeleteDto) {
    return this.attachmentManagementService.bulkSoftDelete(dto.ids);
  }

  @Patch(':id/visibility')
  @Permission(PermissionCode.ATTACHMENT_MANAGE)
  @ApiOperation({ summary: '修改附件可见性' })
  updateVisibility(
    @Param('id') id: string,
    @Body() dto: UpdateManagementVisibilityDto,
  ) {
    return this.attachmentManagementService.updateVisibility(
      id,
      dto.visibility,
    );
  }

  @Post(':id/soft-delete')
  @HttpCode(HttpStatus.OK)
  @Permission(PermissionCode.ATTACHMENT_MANAGE)
  @ApiOperation({ summary: '软删除未绑定附件' })
  async softDelete(@Param('id') id: string) {
    await this.attachmentManagementService.softDelete(id);
  }
}
