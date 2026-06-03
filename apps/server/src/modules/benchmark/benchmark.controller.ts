import { Public } from '@/common/decorators/jwt-auth.decorator';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { BENCHMARK_THROTTLE_DEMO, BenchmarkService } from './benchmark.service';
import { BatchQueryDto } from './dto/batch-query.dto';
import { IncrementHashFieldDto, SetHashFieldDto } from './dto/hash-demo.dto';

@ApiTags('Benchmark - 性能测试')
@Controller('benchmark')
export class BenchmarkController {
  constructor(private readonly benchmarkService: BenchmarkService) {}

  @Public()
  @ApiOperation({
    summary: '单次查询对比',
    description: '对比数据库查询和 Redis 缓存查询的耗时差异',
  })
  @ApiQuery({
    name: 'id',
    required: false,
    description: '用户 ID（不传则使用第一个用户）',
  })
  @Get('single')
  async singleQuery(@Query('id') id?: string) {
    return this.benchmarkService.singleQuery(id);
  }

  @Public()
  @ApiOperation({
    summary: '批量查询对比',
    description: '执行 N 次查询，对比数据库和缓存的总耗时',
  })
  @ApiQuery({
    name: 'count',
    required: false,
    description: '查询次数（默认 100）',
    example: 100,
  })
  @Get('batch')
  async batchQuery(@Query() query: BatchQueryDto) {
    return this.benchmarkService.batchQuery(query.count ?? 100);
  }

  @Public()
  @ApiOperation({
    summary: '场景测试',
    description: '模拟冷启动（无缓存）和热缓存（有缓存）的性能对比',
  })
  @Get('scenario')
  async scenarioTest() {
    return this.benchmarkService.scenarioTest();
  }

  @Public()
  @ApiOperation({
    summary: '限流配置',
    description: '返回当前默认限流配置和演示接口限流配置',
  })
  @Get('throttle/config')
  getThrottleConfig() {
    return this.benchmarkService.getThrottleConfig();
  }

  @Public()
  @Throttle({ default: BENCHMARK_THROTTLE_DEMO })
  @ApiOperation({
    summary: '限流探测',
    description: '低额度限流演示接口，连续调用可观察 429 响应',
  })
  @Get('throttle/probe')
  getThrottleProbe() {
    return this.benchmarkService.getThrottleProbe();
  }

  @Public()
  @ApiOperation({
    summary: '读取 Hash 演示缓存',
    description: '读取固定 demo key 的 Hash 字段数据',
  })
  @Get('hash')
  getHashDemo() {
    return this.benchmarkService.getHashDemo();
  }

  @Public()
  @ApiOperation({
    summary: '写入 Hash 字段',
    description: '向固定 demo key 写入一个 Hash 字段',
  })
  @Post('hash/field')
  setHashField(@Body() body: SetHashFieldDto) {
    return this.benchmarkService.setHashField(body.field, body.value);
  }

  @Public()
  @ApiOperation({
    summary: 'Hash 字段自增',
    description: '对固定 demo key 的数字字段执行 HINCRBY',
  })
  @Post('hash/increment')
  incrementHashField(@Body() body: IncrementHashFieldDto) {
    return this.benchmarkService.incrementHashField(body.field, body.increment);
  }

  @Public()
  @ApiOperation({
    summary: '删除 Hash 字段',
    description: '删除固定 demo key 中的一个 Hash 字段',
  })
  @ApiParam({
    name: 'field',
    description: 'Hash 字段名，仅支持字母、数字、下划线和短横线',
  })
  @Delete('hash/field/:field')
  deleteHashField(@Param('field') field: string) {
    return this.benchmarkService.deleteHashField(field);
  }
}
