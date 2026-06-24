import { TestHelper } from './helpers/test-helper';
import request from 'supertest';
import { describe, expect, it, beforeAll, afterAll, beforeEach } from 'vitest';

describe('Users (e2e)', () => {
  let helper: TestHelper;
  let accessToken: string;
  let userId: string;

  const testUser = {
    username: 'useruser',
    email: 'user@example.com',
    password: 'password123',
    nickname: 'User User',
    roles: ['admin'],
  };

  beforeAll(async () => {
    helper = new TestHelper();
    await helper.init();
    await helper.seedDatabase();
  });

  afterAll(async () => {
    await helper.close();
  });

  beforeEach(async () => {
    await helper.cleanDatabase();
    await helper.seedDatabase();

    // 注册并登录获取 token
    const result = await helper.signupAndLogin(testUser);
    accessToken = result.accessToken;

    // 获取用户 ID
    const meRes = await request(helper.getHttpServer())
      .get('/api/account/profile')
      .set('Authorization', `Bearer ${accessToken}`);

    userId = meRes.body?.id;
  });

  describe('GET /api/users', () => {
    it('should return all users', async () => {
      const res = await request(helper.getHttpServer())
        .get('/api/users')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(Array.isArray(res.body.list)).toBe(true);
      expect(res.body.list.length).toBeGreaterThanOrEqual(1);
    });

    it('should fail without auth', async () => {
      await request(helper.getHttpServer()).get('/api/users').expect(401);
    });
  });

  describe('GET /api/users/:id', () => {
    it('should return a user by id', async () => {
      const res = await request(helper.getHttpServer())
        .get(`/api/users/${userId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.id).toBe(userId);
      expect(res.body.username).toBe(testUser.username);
    });

    it('should return 404 for non-existent user', async () => {
      await request(helper.getHttpServer())
        .get('/api/users/999999')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
    });
  });

  describe('PATCH /api/users/:id', () => {
    it('should update user', async () => {
      const res = await request(helper.getHttpServer())
        .patch(`/api/users/${userId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ nickname: 'Updated Nickname' })
        .expect(200);

      expect(res.body.nickname).toBe('Updated Nickname');
    });

    it('should fail with invalid data', async () => {
      await request(helper.getHttpServer())
        .patch(`/api/users/${userId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ email: 'invalid-email' })
        .expect(400);
    });
  });

  describe('PATCH /api/users/:id/password', () => {
    it('should update user password', async () => {
      await request(helper.getHttpServer())
        .patch(`/api/users/${userId}/password`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ oldPassword: testUser.password, newPassword: 'newpassword123' })
        .expect(200);

      // 用新密码登录
      const loginRes = await request(helper.getHttpServer())
        .post('/api/auth/login')
        .send({ username: testUser.username, password: 'newpassword123' })
        .expect(200);

      expect(loginRes.body).toHaveProperty('accessToken');
    });
  });

  describe('DELETE /api/users/:id', () => {
    it('should delete user', async () => {
      // 创建另一个用户来删除
      const anotherUser = {
        username: 'tobedeleted',
        email: 'delete@example.com',
        password: 'password123',
      };

      const signupRes = await request(helper.getHttpServer())
        .post('/api/auth/signup')
        .send(anotherUser)
        .expect(200);

      const deleteUserId = signupRes.body.id;

      await request(helper.getHttpServer())
        .delete(`/api/users/${deleteUserId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      // 验证已删除
      await request(helper.getHttpServer())
        .get(`/api/users/${deleteUserId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
    });
  });
});
