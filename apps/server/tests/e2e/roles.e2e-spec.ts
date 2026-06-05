import { TestHelper } from './helpers/test-helper';
import request from 'supertest';
import { describe, expect, it, beforeAll, afterAll, beforeEach } from 'vitest';

describe('Roles (e2e)', () => {
  let helper: TestHelper;
  let accessToken: string;

  // 使用 seed 中创建的 admin 用户（SuperAdmin）
  const adminUser = {
    username: process.env.DEFAULT_ADMIN_USERNAME || 'admin',
    password: process.env.DEFAULT_ADMIN_PASSWORD || 'admin1234',
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
    await helper.seedDatabase();

    const loginRes = await request(helper.getHttpServer())
      .post('/api/auth/login')
      .send(adminUser)
      .expect(200);

    accessToken = loginRes.body.accessToken;
  });

  describe('POST /api/roles', () => {
    it('should create a role', async () => {
      const createDto = {
        name: 'test-role',
        code: 'test-role',
        description: 'A test role',
        permissions: [],
      };

      const res = await request(helper.getHttpServer())
        .post('/api/roles')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(createDto)
        .expect(200);

      expect(res.body).toHaveProperty('id');
      expect(res.body.name).toBe(createDto.name);
      expect(res.body.code).toBe(createDto.code);
    });

    it('should fail without auth', async () => {
      await request(helper.getHttpServer())
        .post('/api/roles')
        .send({ name: 'test', code: 'test', permissions: [] })
        .expect(401);
    });
  });

  describe('GET /api/roles', () => {
    it('should return all roles', async () => {
      const res = await request(helper.getHttpServer())
        .get('/api/roles')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('GET /api/roles/:id', () => {
    let roleId: string;

    beforeEach(async () => {
      const res = await request(helper.getHttpServer())
        .get('/api/roles')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      roleId = res.body[0].id;
    });

    it('should return a role by id', async () => {
      const res = await request(helper.getHttpServer())
        .get(`/api/roles/${roleId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.id).toBe(roleId);
    });

    it('should not have id for non-existent role', async () => {
      const res = await request(helper.getHttpServer())
        .get('/api/roles/999999')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.id).toBeUndefined();
    });
  });

  describe('PATCH /api/roles/:id', () => {
    let roleId: string;

    beforeEach(async () => {
      const res = await request(helper.getHttpServer())
        .get('/api/roles')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      roleId = res.body[0].id;
    });

    it('should update role', async () => {
      const res = await request(helper.getHttpServer())
        .patch(`/api/roles/${roleId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ description: 'Updated description' })
        .expect(200);

      expect(res.body.description).toBe('Updated description');
    });
  });

  describe('DELETE /api/roles/:id', () => {
    it('should delete a role', async () => {
      // 先创建一个角色
      const createRes = await request(helper.getHttpServer())
        .post('/api/roles')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'to-delete',
          code: 'to-delete',
          permissions: [],
        })
        .expect(200);

      const roleId = createRes.body.id;

      await request(helper.getHttpServer())
        .delete(`/api/roles/${roleId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      // 软删除后 findOne 不返回 id
      const res = await request(helper.getHttpServer())
        .get(`/api/roles/${roleId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.id).toBeUndefined();
    });
  });
});
