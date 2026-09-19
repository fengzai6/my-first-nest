import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';

const MAX_POSTGRES_BIGINT = 9223372036854775807n;

@Injectable()
export class ParseBigIntPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (!/^\d+$/.test(value) || BigInt(value) > MAX_POSTGRES_BIGINT) {
      throw new BadRequestException('参数验证失败!');
    }

    return value;
  }
}
