import { UserInfo } from '@/common/decorators/jwt-auth.decorator';
import { Public } from '@/common/decorators/jwt-auth.decorator';
import { User } from '@/modules/users/entities/user.entity';
import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Response } from 'express';
import { diskStorage } from 'multer';
import { randomUUID } from 'crypto';
import { mkdir } from 'fs/promises';
import {
  ATTACHMENT_UPLOAD_TEMP_DIR,
  MAX_ATTACHMENT_COUNT,
  MAX_ATTACHMENT_SIZE,
} from './constants/attachment.constants';
import { AttachmentsService } from './attachments.service';
import { ContentAttachmentDto } from './dto/content-attachment.dto';
import { UpdateAttachmentDto } from './dto/update-attachment.dto';
import { UploadAttachmentDto } from './dto/upload-attachment.dto';
import {
  ATTACHMENT_STORAGE,
  IAttachmentStorage,
} from './interfaces/attachment-storage.interface';

@ApiTags('Attachments - 附件')
@Controller('attachments')
export class AttachmentsController {
  constructor(
    private readonly attachmentsService: AttachmentsService,
    @Inject(ATTACHMENT_STORAGE)
    private readonly storage: IAttachmentStorage,
  ) {}

  @Post()
  @ApiBearerAuth()
  @ApiOperation({ summary: '上传附件' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        files: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
        },
        visibility: { type: 'string', enum: ['private', 'public'] },
      },
      required: ['files'],
    },
  })
  @UseInterceptors(
    FilesInterceptor('files', MAX_ATTACHMENT_COUNT, {
      storage: diskStorage({
        destination: (_request, _file, callback) => {
          void mkdir(ATTACHMENT_UPLOAD_TEMP_DIR, { recursive: true })
            .then(() => callback(null, ATTACHMENT_UPLOAD_TEMP_DIR))
            .catch((error: Error) =>
              callback(error, ATTACHMENT_UPLOAD_TEMP_DIR),
            );
        },
        filename: (_request, _file, callback) => callback(null, randomUUID()),
      }),
      limits: { fileSize: MAX_ATTACHMENT_SIZE },
    }),
  )
  async upload(
    @UploadedFiles() files: Express.Multer.File[],
    @Body() dto: UploadAttachmentDto,
    @UserInfo() user: User,
  ) {
    try {
      return await this.attachmentsService.upload(files, dto, user);
    } finally {
      await Promise.allSettled(
        (files ?? []).map((file) => this.storage.cleanup(file)),
      );
    }
  }

  @Get(':id/signed-url')
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取私有附件短时签名 URL' })
  getSignedUrl(@Param('id') id: string) {
    return this.attachmentsService.createSignedUrl(id);
  }

  @Public()
  @Get('content/:id')
  @ApiOperation({ summary: '读取附件内容' })
  async getContent(
    @Param('id') id: string,
    @Query() query: ContentAttachmentDto,
    @Res() response: Response,
  ) {
    const { attachment, content } = await this.attachmentsService.getContent(
      id,
      query.expiresAt,
      query.userId,
      query.signature,
    );

    response.setHeader('Content-Type', attachment.mimeType);
    response.setHeader(
      'Content-Disposition',
      `inline; filename*=UTF-8''${encodeURIComponent(attachment.originalName)}`,
    );
    content.stream.pipe(response);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: '更新附件绑定或可见性' })
  update(@Param('id') id: string, @Body() dto: UpdateAttachmentDto) {
    return this.attachmentsService.update(id, dto);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: '删除附件' })
  async remove(@Param('id') id: string) {
    await this.attachmentsService.remove(id);
  }
}
