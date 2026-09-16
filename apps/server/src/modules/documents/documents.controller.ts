import { PermissionCode } from '@/common/constants/permissions';
import { UserInfo } from '@/common/decorators/jwt-auth.decorator';
import { Permission } from '@/common/decorators/permission.decorator';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { User } from '@/modules/users/entities/user.entity';
import { CreateDocumentDto } from './dto/create-document.dto';
import { FindDocumentsDto } from './dto/find-documents.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
import { DocumentsService } from './documents.service';

@ApiTags('Documents - 资料文档')
@ApiBearerAuth()
@Controller('documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Post()
  @Permission(PermissionCode.DOCUMENT_CREATE)
  @ApiOperation({ summary: '创建资料文档' })
  create(@Body() dto: CreateDocumentDto, @UserInfo() user: User) {
    return this.documentsService.create(dto, user);
  }

  @Get()
  @Permission(PermissionCode.DOCUMENT_READ)
  @ApiOperation({ summary: '查询资料文档列表' })
  findAll(@Query() query: FindDocumentsDto, @UserInfo() user: User) {
    return this.documentsService.findAll(query, user);
  }

  @Get(':id')
  @Permission(PermissionCode.DOCUMENT_READ)
  @ApiOperation({ summary: '查询资料文档详情' })
  findOne(@Param('id') id: string, @UserInfo() user: User) {
    return this.documentsService.findOne(id, user);
  }

  @Patch(':id')
  @Permission(PermissionCode.DOCUMENT_UPDATE)
  @ApiOperation({ summary: '更新资料文档' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateDocumentDto,
    @UserInfo() user: User,
  ) {
    return this.documentsService.update(id, dto, user);
  }

  @Delete(':id')
  @Permission(PermissionCode.DOCUMENT_DELETE)
  @ApiOperation({ summary: '删除资料文档' })
  async remove(@Param('id') id: string, @UserInfo() user: User) {
    await this.documentsService.remove(id, user);
  }

  @Get(':documentId/attachments/:attachmentId/signed-url')
  @Permission(PermissionCode.DOCUMENT_READ)
  @ApiOperation({ summary: '获取资料文档附件签名 URL' })
  getAttachmentSignedUrl(
    @Param('documentId') documentId: string,
    @Param('attachmentId') attachmentId: string,
    @UserInfo() user: User,
  ) {
    return this.documentsService.createAttachmentSignedUrl(
      documentId,
      attachmentId,
      user,
    );
  }
}
