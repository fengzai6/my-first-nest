import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { TestHelper } from './helpers/test-helper';

describe('Permissions (e2e)', () => {
  let helper: TestHelper;
  let accessToken: string;

  const testUser = {
    username: 'permuser',
    email: 'perm@example.com',
    password: 'password123',
    nickname: 'Perm User',
    roles: ['admin'],
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

    const result = await helper.signupAndLogin(testUser);
    accessToken = result.accessToken;
  });

  describe('GET /api/permissions', () => {
    it('should return all permissions', async () => {
      const res = await request(helper.getHttpServer())
        .get('/api/permissions')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
    });

    it('should fail without auth', async () => {
      await request(helper.getHttpServer()).get('/api/permissions').expect(401);
    });
  });

  describe('GET /api/permissions/:id', () => {
    let permissionId: string;

    beforeEach(async () => {
      const res = await request(helper.getHttpServer())
        .get('/api/permissions')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      permissionId = res.body[0].id;
    });

    it('should return a permission by id', async () => {
      const res = await request(helper.getHttpServer())
        .get(`/api/permissions/${permissionId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.id).toBe(permissionId);
    });

    it('should not have id for non-existent permission', async () => {
      const res = await request(helper.getHttpServer())
        .get('/api/permissions/999999')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.id).toBeUndefined();
    });
  });

  describe('PATCH /api/permissions/:id', () => {
    let permissionId: string;

    beforeEach(async () => {
      const res = await request(helper.getHttpServer())
        .get('/api/permissions')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      permissionId = res.body[0].id;
    });

    it('should update permission', async () => {
      const res = await request(helper.getHttpServer())
        .patch(`/api/permissions/${permissionId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ description: 'Updated description' })
        .expect(200);

      expect(res.body.description).toBe('Updated description');
    });
  });
});
