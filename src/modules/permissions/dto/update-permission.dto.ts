import { OmitType, PartialType } from '@nestjs/swagger';
import { CreatePermissionDto } from './create-permission.dto';

export class UpdatePermissionDto extends PartialType(
  OmitType(CreatePermissionDto, ['code'] as const),
) {}
