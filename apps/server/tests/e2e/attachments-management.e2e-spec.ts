import { RoleCode } from '@/common/constants/roles';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { TestHelper } from './helpers/test-helper';

interface IPermissionResponseItem {
  code: string;
}

interface IAttachmentResponseItem {
  id: string;
}

interface IDocumentResponseItem {
  id: string;
}

interface ISignedUrlResponse {
  url: string;
}

interface IManagementListResponse {
  total: number;
  list: Array<{ id: string; status: string }>;
}

interface IBulkResultResponse {
  succeeded: string[];
}

describe('Attachments management permissions (e2e)', () => {
  let helper: TestHelper;
  let userAccessToken: string;
  let adminAccessToken: string;

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

    userAccessToken = (
      await helper.signupAndLogin({
        username: 'attachment-user',
        email: 'attachment-user@example.com',
        password: 'password123',
        roles: [RoleCode.USER],
      })
    ).accessToken;

    adminAccessToken = (
      await helper.signupAndLogin({
        username: 'attachment-admin',
        email: 'attachment-admin@example.com',
        password: 'password123',
        roles: [RoleCode.ADMIN],
      })
    ).accessToken;
  });

  const uploadAttachment = async (
    accessToken: string,
    visibility: 'private' | 'public' = 'private',
  ) =>
    request(helper.getHttpServer())
      .post('/api/attachments')
      .set('Authorization', `Bearer ${accessToken}`)
      .field('visibility', visibility)
      .attach('files', Buffer.from('content'), {
        filename: 'report.pdf',
        contentType: 'application/pdf',
      })
      .expect(200);

  const createDocument = async (accessToken: string, attachmentId: string) =>
    request(helper.getHttpServer())
      .post('/api/documents')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        title: '附件管理测试',
        content: '正文',
        attachmentIds: [attachmentId],
      })
      .expect(200);

  it('grants attachment management permissions to admin', async () => {
    const response = await request(helper.getHttpServer())
      .get('/api/account/permissions')
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .expect(200);

    expect(
      (response.body as IPermissionResponseItem[]).map(
        (permission) => permission.code,
      ),
    ).toEqual(expect.arrayContaining(['attachment:read', 'attachment:manage']));
  });

  it('does not grant attachment management permissions to a normal user', async () => {
    const response = await request(helper.getHttpServer())
      .get('/api/account/permissions')
      .set('Authorization', `Bearer ${userAccessToken}`)
      .expect(200);

    expect(
      (response.body as IPermissionResponseItem[]).map(
        (permission) => permission.code,
      ),
    ).not.toEqual(
      expect.arrayContaining(['attachment:read', 'attachment:manage']),
    );
  });

  it('returns 404 for an inaccessible public attachment after deletion', async () => {
    const upload = await request(helper.getHttpServer())
      .post('/api/attachments')
      .set('Authorization', `Bearer ${userAccessToken}`)
      .field('visibility', 'public')
      .attach('files', Buffer.from('content'), {
        filename: 'report.pdf',
        contentType: 'application/pdf',
      })
      .expect(200);
    const uploadedAttachment = (upload.body as IAttachmentResponseItem[])[0];

    const created = await request(helper.getHttpServer())
      .post('/api/documents')
      .set('Authorization', `Bearer ${userAccessToken}`)
      .send({
        title: '权限边界',
        content: '正文',
        attachmentIds: [uploadedAttachment.id],
      })
      .expect(200);
    const createdDocument = created.body as IDocumentResponseItem;

    await request(helper.getHttpServer())
      .delete(`/api/documents/${createdDocument.id}`)
      .set('Authorization', `Bearer ${userAccessToken}`)
      .expect(200);

    await request(helper.getHttpServer())
      .get(`/api/attachments/content/${uploadedAttachment.id}`)
      .expect(404);
  });

  it('allows admins and rejects normal users from the attachment management list', async () => {
    const freshUserAccessToken = (
      await helper.signupAndLogin({
        username: 'attachment-user-fresh',
        email: 'attachment-user-fresh@example.com',
        password: 'password123',
        roles: [RoleCode.USER],
      })
    ).accessToken;

    await request(helper.getHttpServer())
      .get('/api/attachments/management')
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .expect(200);

    await request(helper.getHttpServer())
      .get('/api/attachments/management')
      .set('Authorization', `Bearer ${freshUserAccessToken}`)
      .expect(403);
  });

  it('lists normal, orphan and deleted attachments with filters', async () => {
    await uploadAttachment(userAccessToken);
    const publicOrphan = await uploadAttachment(userAccessToken, 'public');
    const bound = await uploadAttachment(userAccessToken);
    const boundAttachment = (bound.body as IAttachmentResponseItem[])[0];
    const created = await createDocument(userAccessToken, boundAttachment.id);
    const createdDocument = created.body as IDocumentResponseItem;

    await request(helper.getHttpServer())
      .delete(`/api/documents/${createdDocument.id}`)
      .set('Authorization', `Bearer ${userAccessToken}`)
      .expect(200);

    const response = await request(helper.getHttpServer())
      .get('/api/attachments/management')
      .query({
        includeDeleted: true,
        keyword: 'report',
        visibility: 'public',
      })
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .expect(200);
    const body = response.body as IManagementListResponse;
    const publicOrphanAttachment = (
      publicOrphan.body as IAttachmentResponseItem[]
    )[0];

    expect(body.total).toBe(1);
    expect(body.list[0].id).toBe(publicOrphanAttachment.id);
  });

  it('filters orphan attachments and ignores includeDeleted', async () => {
    await uploadAttachment(userAccessToken);

    const response = await request(helper.getHttpServer())
      .get('/api/attachments/management')
      .query({ orphanOnly: true, includeDeleted: true })
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .expect(200);
    const body = response.body as IManagementListResponse;

    expect(body.list.every((item) => item.status === 'orphan')).toBe(true);
  });

  it('lets admins read a soft deleted attachment with an admin signature', async () => {
    const upload = await uploadAttachment(userAccessToken);
    const uploadedAttachment = (upload.body as IAttachmentResponseItem[])[0];
    const created = await createDocument(
      userAccessToken,
      uploadedAttachment.id,
    );
    const createdDocument = created.body as IDocumentResponseItem;
    await request(helper.getHttpServer())
      .delete(`/api/documents/${createdDocument.id}`)
      .set('Authorization', `Bearer ${userAccessToken}`)
      .expect(200);

    const signed = await request(helper.getHttpServer())
      .get(`/api/attachments/management/${uploadedAttachment.id}/signed-url`)
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .expect(200);
    const signedUrl = signed.body as ISignedUrlResponse;

    await request(helper.getHttpServer()).get(signedUrl.url).expect(200);
  });

  it('does not let a user signature read a soft deleted attachment', async () => {
    const upload = await uploadAttachment(userAccessToken);
    const uploadedAttachment = (upload.body as IAttachmentResponseItem[])[0];
    const created = await createDocument(
      userAccessToken,
      uploadedAttachment.id,
    );
    const createdDocument = created.body as IDocumentResponseItem;
    await request(helper.getHttpServer())
      .delete(`/api/documents/${createdDocument.id}`)
      .set('Authorization', `Bearer ${userAccessToken}`)
      .expect(200);

    await request(helper.getHttpServer())
      .get(`/api/attachments/${uploadedAttachment.id}/signed-url`)
      .set('Authorization', `Bearer ${userAccessToken}`)
      .expect(404);
  });

  it('does not let anonymous admin scope read a soft deleted public attachment', async () => {
    const upload = await uploadAttachment(userAccessToken, 'public');
    const uploadedAttachment = (upload.body as IAttachmentResponseItem[])[0];
    const created = await createDocument(
      userAccessToken,
      uploadedAttachment.id,
    );
    const createdDocument = created.body as IDocumentResponseItem;
    await request(helper.getHttpServer())
      .delete(`/api/documents/${createdDocument.id}`)
      .set('Authorization', `Bearer ${userAccessToken}`)
      .expect(200);

    await request(helper.getHttpServer())
      .get(`/api/attachments/content/${uploadedAttachment.id}`)
      .query({ scope: 'admin' })
      .expect(403);
  });

  it('updates and soft deletes orphan attachments', async () => {
    const first = await uploadAttachment(userAccessToken);
    const second = await uploadAttachment(userAccessToken);
    const firstAttachment = (first.body as IAttachmentResponseItem[])[0];
    const secondAttachment = (second.body as IAttachmentResponseItem[])[0];

    await request(helper.getHttpServer())
      .patch(`/api/attachments/management/${firstAttachment.id}/visibility`)
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({ visibility: 'public' })
      .expect(200);

    const result = await request(helper.getHttpServer())
      .post('/api/attachments/management/bulk/soft-delete')
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({ ids: [firstAttachment.id, secondAttachment.id] })
      .expect(200);
    const resultBody = result.body as IBulkResultResponse;

    expect(resultBody.succeeded).toEqual([
      firstAttachment.id,
      secondAttachment.id,
    ]);
  });

  it('rejects changing a bound attachment', async () => {
    const upload = await uploadAttachment(userAccessToken);
    const uploadedAttachment = (upload.body as IAttachmentResponseItem[])[0];
    await createDocument(userAccessToken, uploadedAttachment.id);

    await request(helper.getHttpServer())
      .patch(`/api/attachments/management/${uploadedAttachment.id}/visibility`)
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({ visibility: 'public' })
      .expect(409);
  });

  it('rejects a second cleanup trigger while one is active', async () => {
    const first = await request(helper.getHttpServer())
      .post('/api/attachments/management/cleanup')
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .expect(200);

    await request(helper.getHttpServer())
      .post('/api/attachments/management/cleanup')
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .expect(409);

    expect((first.body as { id: string }).id).toEqual(expect.any(String));
  });

  it('returns the latest cleanup instead of matching the id route', async () => {
    await request(helper.getHttpServer())
      .post('/api/attachments/management/cleanup')
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .expect(200);

    const response = await request(helper.getHttpServer())
      .get('/api/attachments/management/cleanup/latest')
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .expect(200);

    expect(response.body).toMatchObject({
      name: 'cleanup-attachments',
      id: expect.any(String),
    });
  });
});
