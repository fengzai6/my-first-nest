import {
  JWT_META_KEY,
  JwtMetaEnum,
  Public,
  UserInfo,
} from '@/common/decorators/jwt-auth.decorator';
import 'reflect-metadata';
import { describe, expect, it } from 'vitest';

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

describe('UserInfo', () => {
  it('should be a function that creates decorators', () => {
    expect(typeof UserInfo).toBe('function');

    const decorator = UserInfo();
    expect(decorator).toBeDefined();
  });
});
