import { SpecialRolesEnum } from '@/common/decorators/special-roles.decorator';
import { User } from '@/modules/users/entities/user.entity';
import { LOG_LEVEL } from '@/shared/log/constants/log.constants';
import { LogRecord } from '@/shared/log/entities/log-record.entity';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { TestHelper } from './helpers/test-helper';

describe('Logs (e2e)', () => {
  let helper: TestHelper;

  const developerUser = {
    username: 'logdeveloper',
    email: 'logdeveloper@example.com',
    password: 'password123',
    nickname: 'Log Developer',
  };

  const regularUser = {
    username: 'logregular',
    email: 'logregular@example.com',
    password: 'password123',
    nickname: 'Log Regular',
  };

  const createRecord = (): LogRecord =>
    Object.assign(new LogRecord(), {
      id: '9001',
      level: LOG_LEVEL.ERROR,
      category: 'HTTP',
      message: 'request failed',
      context: { statusCode: 500 },
      requestId: 'request-1',
      userId: null,
      ip: '127.0.0.1',
      method: 'GET',
      url: '/api/logs',
      statusCode: 500,
      duration: 12,
      stack: 'Error: request failed',
      timestamp: new Date('2026-09-10T10:00:00.000Z'),
    });

  const grantDeveloperRole = async (accessToken: string) => {
    const profile = await request(helper.getHttpServer())
      .get('/api/account/profile')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    const profileId = (profile.body as { id: string }).id;

    await helper.dataSource.getRepository(User).update(profileId, {
      specialRoles: [SpecialRolesEnum.Developer],
    });
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
    await helper.dataSource.getRepository(LogRecord).save(createRecord());
  });

  it('returns paginated logs for a developer', async () => {
    const { accessToken } = await helper.signupAndLogin(developerUser);
    await grantDeveloperRole(accessToken);

    const response = await request(helper.getHttpServer())
      .get('/api/logs')
      .query({ page: 1, pageSize: 20, level: LOG_LEVEL.ERROR })
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(response.body).toMatchObject({
      total: 1,
      page: 1,
      pageSize: 20,
    });
    expect(response.body.items).toHaveLength(1);
    expect(response.body.items[0]).toMatchObject({
      id: '9001',
      level: LOG_LEVEL.ERROR,
      requestId: 'request-1',
    });
  });

  it('returns a log detail for a developer', async () => {
    const { accessToken } = await helper.signupAndLogin(developerUser);
    await grantDeveloperRole(accessToken);

    const response = await request(helper.getHttpServer())
      .get('/api/logs/9001')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(response.body).toMatchObject({
      id: '9001',
      context: { statusCode: 500 },
      stack: 'Error: request failed',
    });
  });

  it('returns 404 for a missing log', async () => {
    const { accessToken } = await helper.signupAndLogin(developerUser);
    await grantDeveloperRole(accessToken);

    const response = await request(helper.getHttpServer())
      .get('/api/logs/missing')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(404);

    expect(response.body.code).toBe('16401');
  });

  it('rejects a user without a special role', async () => {
    const { accessToken } = await helper.signupAndLogin(regularUser);

    await request(helper.getHttpServer())
      .get('/api/logs')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(403);
  });
});
