import { TestHelper } from './helpers/test-helper';
import request from 'supertest';
import { describe, expect, it, beforeAll, afterAll, beforeEach } from 'vitest';

describe('Groups (e2e)', () => {
  let helper: TestHelper;
  let accessToken: string;

  const testUser = {
    username: 'groupuser',
    email: 'group@example.com',
    password: 'password123',
    nickname: 'Group User',
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
  });

  describe('POST /api/groups/rootOrg', () => {
    it('should create a root organization group', async () => {
      const createDto = {
        name: 'Root Organization',
        description: 'Root org description',
      };

      const res = await request(helper.getHttpServer())
        .post('/api/groups/rootOrg')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(createDto)
        .expect(200);

      expect(res.body).toHaveProperty('id');
      expect(res.body.name).toBe(createDto.name);
      expect(res.body.isOrganization).toBe(true);
    });

    it('should fail without auth', async () => {
      await request(helper.getHttpServer())
        .post('/api/groups/rootOrg')
        .send({ name: 'Root Org' })
        .expect(401);
    });
  });

  describe('POST /api/groups', () => {
    let parentGroupId: string;

    beforeEach(async () => {
      // 先创建一个父级组织
      const res = await request(helper.getHttpServer())
        .post('/api/groups/rootOrg')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'Parent Org', description: 'Parent' });

      parentGroupId = res.body.id;
    });

    it('should create a child group', async () => {
      const createDto = {
        name: 'Child Group',
        parentId: parentGroupId,
        description: 'Child group description',
      };

      const res = await request(helper.getHttpServer())
        .post('/api/groups')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(createDto)
        .expect(200);

      expect(res.body).toHaveProperty('id');
      expect(res.body.name).toBe(createDto.name);
    });

    it('should fail with invalid parentId', async () => {
      await request(helper.getHttpServer())
        .post('/api/groups')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'Child', parentId: '999999' })
        .expect(404);
    });
  });

  describe('GET /api/groups/trees', () => {
    beforeEach(async () => {
      // 创建测试数据
      const rootRes = await request(helper.getHttpServer())
        .post('/api/groups/rootOrg')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'Root Org' });

      await request(helper.getHttpServer())
        .post('/api/groups')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'Child Group', parentId: rootRes.body.id });
    });

    it('should return group trees', async () => {
      const res = await request(helper.getHttpServer())
        .get('/api/groups/trees')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('PATCH /api/groups/:groupId', () => {
    let groupId: string;

    beforeEach(async () => {
      const res = await request(helper.getHttpServer())
        .post('/api/groups/rootOrg')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'Test Org' });

      groupId = res.body.id;
    });

    it('should update group', async () => {
      const res = await request(helper.getHttpServer())
        .patch(`/api/groups/${groupId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'Updated Org', description: 'Updated description' })
        .expect(200);

      expect(res.body.name).toBe('Updated Org');
      expect(res.body.description).toBe('Updated description');
    });
  });

  describe('Group Members', () => {
    let groupId: string;
    let memberId: string;

    beforeEach(async () => {
      // 创建群组
      const groupRes = await request(helper.getHttpServer())
        .post('/api/groups/rootOrg')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'Member Test Org' });

      groupId = groupRes.body.id;

      // 创建另一个用户作为成员
      const memberRes = await request(helper.getHttpServer())
        .post('/api/auth/signup')
        .send({
          username: 'member',
          email: 'member@example.com',
          password: 'password123',
        });

      memberId = memberRes.body.id;
    });

    it('should add group member', async () => {
      const res = await request(helper.getHttpServer())
        .post(`/api/groups/${groupId}/members`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ members: [memberId] })
        .expect(200);

      expect(res.body).toBeDefined();
    });

    it('should remove group member', async () => {
      // 先添加成员
      await request(helper.getHttpServer())
        .post(`/api/groups/${groupId}/members`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ members: [memberId] });

      // 移除成员
      await request(helper.getHttpServer())
        .delete(`/api/groups/${groupId}/members/${memberId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
    });
  });
});
