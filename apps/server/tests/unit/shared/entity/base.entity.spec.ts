import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { BaseEntity } from '@/shared/entity/base.entity';
import { initSnowflake, resetSnowflake } from '@/shared/utils/snowflake';

class TestEntity extends BaseEntity {}

describe('BaseEntity', () => {
  beforeEach(() => {
    initSnowflake(0n, 0n);
  });

  afterEach(() => {
    resetSnowflake();
  });

  it('should generate id before insert when id is empty', () => {
    const entity = new TestEntity();

    entity.generateId();

    expect(entity.id).toEqual(expect.any(String));
    expect(entity.id.length).toBeGreaterThan(0);
  });

  it('should keep existing id before insert', () => {
    const entity = new TestEntity();

    entity.id = 'existing-id';
    entity.generateId();

    expect(entity.id).toBe('existing-id');
  });
});
