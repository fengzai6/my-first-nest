import { validationSchema } from '@/config/env.validation';
import { describe, expect, it } from 'vitest';

const baseEnv = {
  DEFAULT_ADMIN_USERNAME: 'admin',
  DEFAULT_ADMIN_PASSWORD: 'password',
  JWT_SECRET: 'secret',
  DATABASE_HOST: 'localhost',
  DATABASE_PORT: 5432,
  DATABASE_USERNAME: 'postgres',
  DATABASE_PASSWORD: 'postgres',
  DATABASE_NAME: 'test',
  UPLOAD_SIGNATURE_SECRET: 'a-strong-upload-signature-secret',
};

const validateSeqConfig = (seqUrl: string, seqApiKey: string) =>
  validationSchema.validate({
    ...baseEnv,
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
      ...baseEnv,
      SEQ_ENABLED: true,
    });

    expect(result.error).toBeDefined();
  });
});

describe('attachment signature validation', () => {
  it('rejects a missing upload signature secret', () => {
    const { UPLOAD_SIGNATURE_SECRET: _secret, ...envWithoutSecret } = baseEnv;

    expect(validationSchema.validate(envWithoutSecret).error).toBeDefined();
  });

  it('accepts an explicit upload signature secret', () => {
    expect(validationSchema.validate({ ...baseEnv }).error).toBeUndefined();
  });

  it('rejects the known placeholder upload signature secret', () => {
    expect(
      validationSchema.validate({
        ...baseEnv,
        UPLOAD_SIGNATURE_SECRET: 'my-first-nest-upload-signature-secret',
      }).error,
    ).toBeDefined();
  });
});
