import { ApiProperty } from '@nestjs/swagger';
import { IsNumber } from 'class-validator';

export class UpdateCatDto {
  @ApiProperty({
    description: 'The ID of the owner of the cat',
    example: 1,
  })
  @IsNumber()
  ownerId: number;
}
