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
  findAll(@UserInfo() user: User): Promise<Cat[]> {
    console.log('user:', user);
    return this.catsService.findAll();
  }

  @ApiOperation({
    summary: 'Get a cat by id',
  })
  @Permission(PermissionCode.CAT_READ)
  @Get(':id')
  findOne(@Param('id') id: string) {
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
