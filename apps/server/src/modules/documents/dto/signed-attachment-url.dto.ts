import { ApiProperty } from '@nestjs/swagger';

export class SignedAttachmentUrlDto {
  @ApiProperty()
  url: string;

  @ApiProperty()
  expiresAt: number;
}
