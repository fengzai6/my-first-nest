import { validationSchema } from '@/config/env.validation';
import { describe, expect, it } from 'vitest';

const validateSeqConfig = (seqUrl: string, seqApiKey: string) =>
  validationSchema.validate({
    DEFAULT_ADMIN_USERNAME: 'admin',
    DEFAULT_ADMIN_PASSWORD: 'password',
    JWT_SECRET: 'secret',
    DATABASE_HOST: 'localhost',
    DATABASE_PORT: 5432,
    DATABASE_USERNAME: 'postgres',
    DATABASE_PASSWORD: 'postgres',
    DATABASE_NAME: 'test',
    SEQ_ENABLED: true,
    SEQ_URL: seqUrl,
    SEQ_API_KEY: seqApiKey,
  });

describe('SEQ validation', () => {
  it('allows an API key over HTTPS', () => {
    expect(
      validateSeqConfig('https://seq.example.com', 'secret').error,
    ).toBeUndefined();
  });

  it('rejects an API key over HTTP', () => {
    expect(
      validateSeqConfig('http://localhost:5341', 'secret').error,
    ).toBeDefined();
  });

  it('allows an HTTP URL without an API key for local development', () => {
    expect(
      validateSeqConfig('http://localhost:5341', '').error,
    ).toBeUndefined();
  });

  it('rejects an enabled Seq without a URL', () => {
    const result = validationSchema.validate({
      DEFAULT_ADMIN_USERNAME: 'admin',
      DEFAULT_ADMIN_PASSWORD: 'password',
      JWT_SECRET: 'secret',
      DATABASE_HOST: 'localhost',
      DATABASE_PORT: 5432,
      DATABASE_USERNAME: 'postgres',
      DATABASE_PASSWORD: 'postgres',
      DATABASE_NAME: 'test',
      SEQ_ENABLED: true,
    });

    expect(result.error).toBeDefined();
  });
});

describe('attachment cleanup validation', () => {
  it('rejects an attachment cleanup batch size above 1000', () => {
    const result = validationSchema.validate({
      DEFAULT_ADMIN_USERNAME: 'admin',
      DEFAULT_ADMIN_PASSWORD: 'password',
      JWT_SECRET: 'secret',
      DATABASE_HOST: 'localhost',
      DATABASE_PORT: 5432,
      DATABASE_USERNAME: 'postgres',
      DATABASE_PASSWORD: 'postgres',
      DATABASE_NAME: 'test',
      ATTACHMENT_CLEANUP_BATCH_SIZE: 1001,
    });

    expect(result.error).toBeDefined();
  });

  it('uses attachment cleanup defaults', () => {
    const result = validationSchema.validate({
      DEFAULT_ADMIN_USERNAME: 'admin',
      DEFAULT_ADMIN_PASSWORD: 'password',
      JWT_SECRET: 'secret',
      DATABASE_HOST: 'localhost',
      DATABASE_PORT: 5432,
      DATABASE_USERNAME: 'postgres',
      DATABASE_PASSWORD: 'postgres',
      DATABASE_NAME: 'test',
    });

    expect(result.value.ATTACHMENT_CLEANUP_RETENTION_DAYS).toBe(7);
    expect(result.value.ATTACHMENT_CLEANUP_BATCH_SIZE).toBe(100);
  });
});
