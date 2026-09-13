import { SpecialRolesEnum } from '@/common/decorators/special-roles.decorator';
import { SpecialRolesGuard } from '@/common/guards/special-roles.guard';
import { SpecialRoles } from '@/common/decorators/special-roles.decorator';
import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { QueryLogDto } from './dto/query-log.dto';
import type { IQueryLogs } from './interfaces/log.interface';
import { LogService } from './log.service';

const toQueryLogs = (query: QueryLogDto): IQueryLogs => ({
  ...query,
  startTime: query.startTime ? new Date(query.startTime) : undefined,
  endTime: query.endTime ? new Date(query.endTime) : undefined,
});

@ApiTags('Logs - 日志')
@ApiBearerAuth()
@Controller('logs')
@UseGuards(SpecialRolesGuard)
@SpecialRoles([SpecialRolesEnum.Developer, SpecialRolesEnum.SuperAdmin])
export class LogController {
  constructor(private readonly logs: LogService) {}

  @Get()
  @ApiOperation({ summary: '分页查询日志' })
  list(@Query() query: QueryLogDto) {
    return this.logs.list(toQueryLogs(query));
  }

  @Get(':id')
  @ApiOperation({ summary: '查询日志详情' })
  @ApiParam({ name: 'id', description: 'log_records.id' })
  getById(@Param('id') id: string) {
    return this.logs.getById(id);
  }
}
