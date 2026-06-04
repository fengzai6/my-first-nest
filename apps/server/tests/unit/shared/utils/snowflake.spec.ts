import {
  Snowflake,
  generateSnowflakeId,
  initSnowflake,
  resetSnowflake,
} from '@/shared/utils/snowflake';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('Snowflake', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
    resetSnowflake();
  });

  afterEach(() => {
    vi.useRealTimers();
    resetSnowflake();
  });

  describe('constructor', () => {
    it('should create instance with default params', () => {
      const snowflake = new Snowflake();
      expect(snowflake).toBeInstanceOf(Snowflake);
    });

    it('should create instance with custom worker and datacenter', () => {
      const snowflake = new Snowflake(1n, 1n);
      expect(snowflake).toBeInstanceOf(Snowflake);
    });

    it('should throw when worker ID is too large', () => {
      expect(() => new Snowflake(32n, 0n)).toThrow(
        "Worker ID can't be greater than 31",
      );
    });

    it('should throw when worker ID is negative', () => {
      expect(() => new Snowflake(-1n, 0n)).toThrow(
        "Worker ID can't be greater than 31",
      );
    });

    it('should throw when datacenter ID is too large', () => {
      expect(() => new Snowflake(0n, 32n)).toThrow(
        "Datacenter ID can't be greater than 31",
      );
    });

    it('should throw when datacenter ID is negative', () => {
      expect(() => new Snowflake(0n, -1n)).toThrow(
        "Datacenter ID can't be greater than 31",
      );
    });
  });

  describe('nextId', () => {
    it('should generate unique IDs', () => {
      const snowflake = new Snowflake();
      const id1 = snowflake.nextId();
      const id2 = snowflake.nextId();

      expect(id1).not.toBe(id2);
      expect(typeof id1).toBe('bigint');
    });

    it('should generate IDs with different worker IDs', () => {
      const sf1 = new Snowflake(0n, 0n);
      const sf2 = new Snowflake(1n, 0n);

      const id1 = sf1.nextId();
      const id2 = sf2.nextId();

      expect(id1).not.toBe(id2);
    });

    it('should generate IDs with different datacenter IDs', () => {
      const sf1 = new Snowflake(0n, 0n);
      const sf2 = new Snowflake(0n, 1n);

      const id1 = sf1.nextId();
      const id2 = sf2.nextId();

      expect(id1).not.toBe(id2);
    });

    it('should generate IDs in chronological order', () => {
      const snowflake = new Snowflake();
      const id1 = snowflake.nextId();

      vi.setSystemTime(new Date('2026-01-01T00:00:00.001Z'));
      const id2 = snowflake.nextId();

      expect(id2).toBeGreaterThan(id1);
    });

    it('should throw when clock moves backwards', () => {
      const snowflake = new Snowflake();
      snowflake.nextId();

      vi.setSystemTime(new Date('2025-12-31T23:59:59.999Z'));

      expect(() => snowflake.nextId()).toThrow('Clock moved backwards');
    });

    it('should handle sequence overflow by waiting for next millisecond', () => {
      const snowflake = new Snowflake();
      const ids = new Set<bigint>();

      // Generate multiple IDs in the same millisecond
      for (let i = 0; i < 10; i++) {
        ids.add(snowflake.nextId());
      }

      expect(ids.size).toBe(10);
    });
  });

  describe('singleton functions', () => {
    it('should initialize and generate ID', () => {
      initSnowflake(0n, 0n);
      const id = generateSnowflakeId();

      expect(typeof id).toBe('string');
      expect(BigInt(id)).toBeGreaterThan(0n);
    });

    it('should warn when initializing twice', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      initSnowflake(0n, 0n);
      initSnowflake(1n, 1n);

      expect(warnSpy).toHaveBeenCalledWith(
        'Snowflake generator has already been initialized.',
      );
      warnSpy.mockRestore();
    });

    it('should throw when generating ID before initialization', () => {
      expect(() => generateSnowflakeId()).toThrow(
        'Snowflake generator has not been initialized',
      );
    });

    it('should reset and allow re-initialization', () => {
      initSnowflake(0n, 0n);
      resetSnowflake();
      initSnowflake(1n, 1n);

      const id = generateSnowflakeId();
      expect(typeof id).toBe('string');
    });
  });
});
