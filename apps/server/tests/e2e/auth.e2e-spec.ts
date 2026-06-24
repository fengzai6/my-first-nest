import { TestHelper } from './helpers/test-helper';
import request from 'supertest';
import { describe, expect, it, beforeAll, afterAll, beforeEach } from 'vitest';

describe('Auth (e2e)', () => {
  let helper: TestHelper;

  const testUser = {
    username: 'testuser',
    email: 'test@example.com',
    password: 'password123',
    nickname: 'Test User',
  };

  beforeAll(async () => {
    helper = new TestHelper();
    await helper.init();
  });

  afterAll(async () => {
    await helper.close();
  });

  beforeEach(async () => {
    await helper.cleanDatabase();
  });

  describe('POST /api/auth/signup', () => {
    it('should register a new user', async () => {
      const res = await request(helper.getHttpServer())
        .post('/api/auth/signup')
        .send(testUser)
        .expect(200);

      expect(res.body).toHaveProperty('id');
      expect(res.body.username).toBe(testUser.username);
      expect(res.body.email).toBe(testUser.email);
      // password should not be returned
      expect(res.body).not.toHaveProperty('password');
    });

    it('should fail with duplicate username', async () => {
      await request(helper.getHttpServer())
        .post('/api/auth/signup')
        .send(testUser)
        .expect(200);

      await request(helper.getHttpServer())
        .post('/api/auth/signup')
        .send(testUser)
        .expect(409);
    });

    it('should fail with invalid email', async () => {
      await request(helper.getHttpServer())
        .post('/api/auth/signup')
        .send({ ...testUser, email: 'invalid-email' })
        .expect(400);
    });

    it('should fail with short password', async () => {
      await request(helper.getHttpServer())
        .post('/api/auth/signup')
        .send({ ...testUser, password: '123' })
        .expect(400);
    });
  });

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      await request(helper.getHttpServer())
        .post('/api/auth/signup')
        .send(testUser);
    });

    it('should login successfully', async () => {
      const res = await request(helper.getHttpServer())
        .post('/api/auth/login')
        .send({ username: testUser.username, password: testUser.password })
        .expect(200);

      expect(res.body).toHaveProperty('accessToken');
      expect(res.body).toHaveProperty('expiresAt');

      // should set refreshToken cookie
      const cookies = res.headers['set-cookie'] as string[];
      expect(cookies).toBeDefined();
      expect(cookies.some((c) => c.startsWith('refreshToken='))).toBe(true);
    });

    it('should fail with wrong password', async () => {
      await request(helper.getHttpServer())
        .post('/api/auth/login')
        .send({ username: testUser.username, password: 'wrongpassword' })
        .expect(401);
    });

    it('should fail with non-existent user', async () => {
      await request(helper.getHttpServer())
        .post('/api/auth/login')
        .send({ username: 'nonexistent', password: 'password123' })
        .expect(401);
    });
  });

  describe('POST /api/auth/refresh-token', () => {
    let refreshToken: string;

    beforeEach(async () => {
      const result = await helper.signupAndLogin(testUser);
      refreshToken = result.refreshToken;
    });

    it('should refresh token successfully', async () => {
      const res = await request(helper.getHttpServer())
        .post('/api/auth/refresh-token')
        .set('Cookie', [`refreshToken=${refreshToken}`])
        .expect(200);

      expect(res.body).toHaveProperty('accessToken');
      expect(res.body).toHaveProperty('expiresAt');

      // should set new refreshToken cookie
      const cookies = res.headers['set-cookie'] as string[];
      expect(cookies).toBeDefined();
      expect(cookies.some((c) => c.startsWith('refreshToken='))).toBe(true);
    });

    it('should fail without refresh token', async () => {
      await request(helper.getHttpServer())
        .post('/api/auth/refresh-token')
        .expect(401);
    });
  });

  describe('POST /api/auth/logout', () => {
    let accessToken: string;
    let refreshToken: string;

    beforeEach(async () => {
      const result = await helper.signupAndLogin(testUser);
      accessToken = result.accessToken;
      refreshToken = result.refreshToken;
    });

    it('should logout successfully', async () => {
      const res = await request(helper.getHttpServer())
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('Cookie', [`refreshToken=${refreshToken}`])
        .expect(200);

      expect(res.body.message).toBe('Logout successfully');

      // should clear refreshToken cookie
      const cookies = res.headers['set-cookie'] as string[];
      expect(cookies).toBeDefined();
      expect(cookies.some((c) => c.includes('refreshToken=;'))).toBe(true);
    });
  });
});
