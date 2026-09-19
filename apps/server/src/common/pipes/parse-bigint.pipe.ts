import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';

@Injectable()
export class ParseBigIntPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (!/^\d+$/.test(value)) {
      throw new BadRequestException('参数验证失败!');
    }

    return value;
  }
}
