import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import {
  JWT_META_KEY,
  JwtMetaEnum,
  Public,
} from '@/common/decorators/jwt-auth.decorator';

describe('Public', () => {
  it('should mark route as public', () => {
    @Public()
    class TestController {
      getPublicData() {
        return null;
      }
    }

    const metadata = Reflect.getMetadata(
      JWT_META_KEY,
      TestController,
    ) as unknown;

    expect(metadata).toBe(JwtMetaEnum.PUBLIC);
  });
});
