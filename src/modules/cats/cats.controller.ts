import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import { AuthGuard } from 'src/common/guards/auth.guard';
import { Roles, RolesEnum } from 'src/common/guards/roles.decorator';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { CatsService } from './cats.service';
import { CreateCatDto } from './dto/create-cat.dto';
import { UpdateCatDto } from './dto/update-cat.dto';
import { Cat } from './interfaces/cat.interface';

@Controller('cats')
@UseGuards(AuthGuard, RolesGuard)
// @UseInterceptors(LoggingInterceptor)
export class CatsController {
  constructor(private catsService: CatsService) {}

  @Post()
  // @HttpCode(200)
  // @Header('Cache-Control', 'none')
  // @Roles(['admin'])
  @ApiOperation({
    summary: 'Create a new cat',
  })
  @Roles([RolesEnum.Admin])
  create(@Body() createCatDto: CreateCatDto) {
    console.log(createCatDto);

    this.catsService.create(createCatDto);
  }

  @Patch('owner/:id')
  updateOwner(@Param('id') id: number, @Body() updateCatDto: UpdateCatDto) {
    return this.catsService.updateOwner(id, updateCatDto);
  }

  @Get()
  async findAll(): Promise<Cat[]> {
    try {
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

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    console.log(id);
    return this.catsService.findOne(id);
  }

  // @Get('')
  // findOneByUuid(@Query('uuid', ParseUUIDPipe) uuid: string) {
  //   return this.catsService.findOneByUuid(uuid);
  // }
}
