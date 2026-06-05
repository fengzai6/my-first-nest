import { TestHelper } from './helpers/test-helper';
import request from 'supertest';
import { describe, expect, it, beforeAll, afterAll, beforeEach } from 'vitest';

describe('Cats (e2e)', () => {
  let helper: TestHelper;
  let accessToken: string;

  const testUser = {
    username: 'catuser',
    email: 'cat@example.com',
    password: 'password123',
    nickname: 'Cat User',
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
  });

  describe('POST /api/cats', () => {
    it('should create a cat', async () => {
      const createCatDto = { name: 'Kitty', age: 3, breed: 'Persian' };

      const res = await request(helper.getHttpServer())
        .post('/api/cats')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(createCatDto)
        .expect(200);

      expect(res.body).toHaveProperty('id');
      expect(res.body.name).toBe(createCatDto.name);
      expect(res.body.age).toBe(createCatDto.age);
      expect(res.body.breed).toBe(createCatDto.breed);
    });

    it('should fail without auth', async () => {
      await request(helper.getHttpServer())
        .post('/api/cats')
        .send({ name: 'Kitty', age: 3, breed: 'Persian' })
        .expect(401);
    });

    it('should fail with invalid data', async () => {
      await request(helper.getHttpServer())
        .post('/api/cats')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'Kitty' }) // missing age and breed
        .expect(400);
    });
  });

  describe('GET /api/cats', () => {
    beforeEach(async () => {
      // 创建测试数据
      await request(helper.getHttpServer())
        .post('/api/cats')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'Kitty', age: 3, breed: 'Persian' });

      await request(helper.getHttpServer())
        .post('/api/cats')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'Tom', age: 5, breed: 'Siamese' });
    });

    it('should return all cats', async () => {
      const res = await request(helper.getHttpServer())
        .get('/api/cats')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(2);
    });

    it('should fail without auth', async () => {
      await request(helper.getHttpServer()).get('/api/cats').expect(401);
    });
  });

  describe('GET /api/cats/:id', () => {
    let catId: string;

    beforeEach(async () => {
      const res = await request(helper.getHttpServer())
        .post('/api/cats')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'Kitty', age: 3, breed: 'Persian' });

      catId = res.body.id;
    });

    it('should return a cat by id', async () => {
      const res = await request(helper.getHttpServer())
        .get(`/api/cats/${catId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.id).toBe(catId);
      expect(res.body.name).toBe('Kitty');
    });

    it('should return 404 for non-existent cat', async () => {
      await request(helper.getHttpServer())
        .get('/api/cats/999999')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
    });
  });

  describe('PATCH /api/cats/owner/:id', () => {
    let catId: string;
    let userId: string;

    beforeEach(async () => {
      const catRes = await request(helper.getHttpServer())
        .post('/api/cats')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'Kitty', age: 3, breed: 'Persian' });

      catId = catRes.body.id;

      const meRes = await request(helper.getHttpServer())
        .get('/api/account/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      userId = meRes.body.id;
    });

    it('should update cat owner', async () => {
      const res = await request(helper.getHttpServer())
        .patch(`/api/cats/owner/${catId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ ownerId: userId })
        .expect(200);

      expect(res.body.owner).toBeDefined();
    });
  });

  describe('DELETE /api/cats/:id', () => {
    let catId: string;

    beforeEach(async () => {
      const res = await request(helper.getHttpServer())
        .post('/api/cats')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'Kitty', age: 3, breed: 'Persian' });

      catId = res.body.id;
    });

    it('should delete a cat', async () => {
      await request(helper.getHttpServer())
        .delete(`/api/cats/${catId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      // 验证已删除
      await request(helper.getHttpServer())
        .get(`/api/cats/${catId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
    });
  });
});
