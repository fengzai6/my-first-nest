import { Public } from '@/common/decorators/jwt-auth.decorator';
import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { BenchmarkService } from './benchmark.service';

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
  async batchQuery(@Query('count') count?: string) {
    const parsedCount = count ? parseInt(count, 10) : 100;
    return this.benchmarkService.batchQuery(parsedCount);
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
}
