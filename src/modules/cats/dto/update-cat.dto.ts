import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class UpdateCatDto {
  @ApiProperty({
    description: 'The ID of the owner of the cat',
    example: '1',
  })
  @IsString()
  ownerId: string;
}
