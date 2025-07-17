import { PermissionCode } from '@/common/constants';
import { UserInfo } from '@/common/decorators/jwt-auth.decorator';
import { Permission } from '@/common/decorators/permission.decorator';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { User } from '../users/entities/user.entity';
import { CatsService } from './cats.service';
import { CreateCatDto } from './dto/create-cat.dto';
import { UpdateCatDto } from './dto/update-cat.dto';
import { Cat } from './interfaces/cat.interface';

@ApiBearerAuth()
@Controller('cats')
// @UseInterceptors(LoggingInterceptor)
export class CatsController {
  constructor(private catsService: CatsService) {}

  // @HttpCode(200)
  // @Header('Cache-Control', 'none')
  // @Roles(['admin'])
  @ApiOperation({
    summary: 'Create a new cat',
  })
  @Permission(PermissionCode.CAT_CREATE)
  @Post()
  create(@Body() createCatDto: CreateCatDto) {
    console.log(createCatDto);

    return this.catsService.create(createCatDto);
  }

  @ApiOperation({
    summary: 'Update the owner of a cat',
  })
  @Permission(PermissionCode.CAT_UPDATE)
  @Patch('owner/:id')
  updateOwner(@Param('id') id: string, @Body() updateCatDto: UpdateCatDto) {
    return this.catsService.updateOwner(id, updateCatDto);
  }

  @ApiOperation({
    summary: 'Get all cats',
  })
  @Permission(PermissionCode.CAT_READ)
  @Get()
  async findAll(@UserInfo() user: User): Promise<Cat[]> {
    try {
      console.log('user:', user);
      return this.catsService.findAll();
    } catch (error) {
      throw new HttpException(
        {
          status: HttpStatus.FORBIDDEN,
          error: 'This is a custom message',
        },
        HttpStatus.FORBIDDEN,
        {
          cause: error,
        },
      );
    }
  }

  // 抛出异常：Forbidden 403
  // @Get()
  // async findAll() {
  //   throw new ForbiddenException();;
  // }

  // @Get(':id')
  // findOne(
  //   @Param(
  //     'id',
  //     // 可以传递配置选项
  //     new ParseIntPipe({ errorHttpStatusCode: HttpStatus.NOT_ACCEPTABLE }),
  //   )
  //   id: number,
  // ) {
  //   return this.catsService.findOne(id);
  // }

  @ApiOperation({
    summary: 'Get a cat by id',
  })
  @Permission(PermissionCode.CAT_READ)
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: string) {
    console.log(id);
    return this.catsService.findOne(id);
  }

  @ApiOperation({
    summary: 'Delete a cat',
  })
  @Permission(PermissionCode.CAT_DELETE)
  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.catsService.remove(id);
  }

  // @Get('')
  // findOneByUuid(@Query('uuid', ParseUUIDPipe) uuid: string) {
  //   return this.catsService.findOneByUuid(uuid);
  // }
}
