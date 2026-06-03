import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class SetHashFieldDto {
  @ApiProperty({
    example: 'views',
    description: 'Hash 字段名，仅支持字母、数字、下划线和短横线',
  })
  @IsString()
  @MaxLength(40)
  @Matches(/^[a-zA-Z0-9_-]+$/)
  field!: string;

  @ApiProperty({
    example: '100',
    description: '字段值，演示接口统一按字符串写入',
  })
  @IsString()
  @MaxLength(120)
  value!: string;
}

export class IncrementHashFieldDto {
  @ApiProperty({
    example: 'views',
    description: 'Hash 字段名，仅支持字母、数字、下划线和短横线',
  })
  @IsString()
  @MaxLength(40)
  @Matches(/^[a-zA-Z0-9_-]+$/)
  field!: string;

  @ApiPropertyOptional({
    example: 1,
    description: '自增步长',
  })
  @IsOptional()
  @IsInt()
  @Min(-1000)
  @Max(1000)
  increment?: number;
}
