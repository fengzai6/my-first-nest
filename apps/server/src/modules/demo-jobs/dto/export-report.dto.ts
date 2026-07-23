import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class ExportReportDto {
  @ApiPropertyOptional({
    description: '导出标题',
    example: 'monthly-report',
  })
  @IsOptional()
  @IsString()
  title?: string = 'monthly-report';

  @ApiPropertyOptional({
    description: '模拟导出步数',
    example: 5,
    minimum: 1,
    maximum: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  steps?: number = 5;

  @ApiPropertyOptional({
    description: '每步延迟毫秒',
    example: 500,
    minimum: 0,
    maximum: 5000,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(5000)
  stepDelayMs?: number = 500;

  @ApiPropertyOptional({
    description: '延迟入队毫秒（用于演示 delayed 状态 / 取消）',
    example: 0,
    minimum: 0,
    maximum: 60000,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(60000)
  delayMs?: number = 0;
}
