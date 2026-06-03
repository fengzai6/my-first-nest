import { ArgumentMetadata, BadRequestException } from '@nestjs/common';
import { IsString } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { ValidationPipe } from '@/common/pipes/validation.pipe';

class CreateUserDto {
  @IsString()
  name!: string;
}

describe('ValidationPipe', () => {
  it('should return value directly for primitive metatype', async () => {
    const pipe = new ValidationPipe<string>();
    const metadata: ArgumentMetadata = {
      type: 'param',
      metatype: String,
      data: 'id',
    };

    await expect(pipe.transform('user-id', metadata)).resolves.toBe('user-id');
  });

  it('should return value when dto validation passes', async () => {
    const pipe = new ValidationPipe<{ name: string }>();
    const value = { name: 'fengzai' };
    const metadata: ArgumentMetadata = {
      type: 'body',
      metatype: CreateUserDto,
      data: '',
    };

    await expect(pipe.transform(value, metadata)).resolves.toBe(value);
  });

  it('should throw bad request when dto validation fails', async () => {
    const pipe = new ValidationPipe<{ name: number }>();
    const metadata: ArgumentMetadata = {
      type: 'body',
      metatype: CreateUserDto,
      data: '',
    };

    await expect(pipe.transform({ name: 1 }, metadata)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
