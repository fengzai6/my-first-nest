import { RoleCode } from '@/common/constants/roles';
import { Attachment } from '@/modules/attachments/entities/attachment.entity';
import { Document } from '@/modules/documents/entities/document.entity';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { TestHelper } from './helpers/test-helper';

describe('Documents (e2e)', () => {
  let helper: TestHelper;
  let accessToken: string;
  let otherAccessToken: string;
  let adminAccessToken: string;

  beforeEach(async () => {
    await helper.cleanDatabase();
    await helper.seedDatabase();

    const owner = await helper.signupAndLogin({
      username: 'document-user',
      email: 'document@example.com',
      password: 'password123',
      roles: [RoleCode.USER],
    });
    accessToken = owner.accessToken;

    const other = await helper.signupAndLogin({
      username: 'other-document-user',
      email: 'other-document@example.com',
      password: 'password123',
      roles: [RoleCode.USER],
    });
    otherAccessToken = other.accessToken;

    const admin = await helper.signupAndLogin({
      username: 'document-admin',
      email: 'document-admin@example.com',
      password: 'password123',
      roles: [RoleCode.ADMIN],
    });
    adminAccessToken = admin.accessToken;
  });

  beforeAll(async () => {
    helper = new TestHelper();
    await helper.init();
    await helper.seedDatabase();
  });

  afterAll(async () => {
    await helper.close();
  });

  const uploadAttachment = async () =>
    request(helper.getHttpServer())
      .post('/api/attachments')
      .set('Authorization', `Bearer ${accessToken}`)
      .attach('files', Buffer.from('image'), {
        filename: 'image.png',
        contentType: 'image/png',
      })
      .expect(200);

  it('creates a document with an uploaded private attachment', async () => {
    const upload = await uploadAttachment();

    const created = await request(helper.getHttpServer())
      .post('/api/documents')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        title: '附件闭环',
        content: '测试正文',
        attachmentIds: [upload.body[0].id],
      })
      .expect(200);

    expect(created.body.attachments).toHaveLength(1);
    expect(created.body.attachments[0]).toMatchObject({
      id: upload.body[0].id,
      bizType: 'document',
      bizId: created.body.id,
    });
  });

  it('lets the document owner get a private attachment signed url', async () => {
    const upload = await uploadAttachment();
    const created = await request(helper.getHttpServer())
      .post('/api/documents')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        title: '签名',
        content: '正文',
        attachmentIds: [upload.body[0].id],
      })
      .expect(200);

    const response = await request(helper.getHttpServer())
      .get(
        `/api/documents/${created.body.id}/attachments/${upload.body[0].id}/signed-url`,
      )
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(response.body.url).toContain('/api/attachments/content/');
    expect(response.body.expiresAt).toEqual(expect.any(Number));
  });

  it('rejects another ordinary user with 403', async () => {
    const created = await request(helper.getHttpServer())
      .post('/api/documents')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ title: '私有文档', content: '正文' })
      .expect(200);

    await request(helper.getHttpServer())
      .get(`/api/documents/${created.body.id}`)
      .set('Authorization', `Bearer ${otherAccessToken}`)
      .expect(403);
  });

  it('lets an admin read another user document', async () => {
    const created = await request(helper.getHttpServer())
      .post('/api/documents')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ title: '管理员可见', content: '正文' })
      .expect(200);

    await request(helper.getHttpServer())
      .get(`/api/documents/${created.body.id}`)
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .expect(200);
  });

  it('updates additions, keeps existing attachments, and removes old ones', async () => {
    const firstUpload = await uploadAttachment();
    const secondUpload = await uploadAttachment();
    const thirdUpload = await uploadAttachment();
    const created = await request(helper.getHttpServer())
      .post('/api/documents')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        title: '附件更新',
        content: '正文',
        attachmentIds: [firstUpload.body[0].id, secondUpload.body[0].id],
      })
      .expect(200);

    const updated = await request(helper.getHttpServer())
      .patch(`/api/documents/${created.body.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        attachmentIds: [secondUpload.body[0].id, thirdUpload.body[0].id],
      })
      .expect(200);

    expect(
      updated.body.attachments.map((item: { id: string }) => item.id),
    ).toEqual(
      expect.arrayContaining([secondUpload.body[0].id, thirdUpload.body[0].id]),
    );
    expect(updated.body.attachments).toHaveLength(2);

    const removed = await helper.dataSource.getRepository(Attachment).findOne({
      where: { id: firstUpload.body[0].id },
      withDeleted: true,
    });
    expect(removed?.deletedAt).toBeInstanceOf(Date);
  });

  it('returns 409 for an attachment already bound to another business object', async () => {
    const upload = await uploadAttachment();
    await request(helper.getHttpServer())
      .post('/api/documents')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        title: '首次绑定',
        content: '正文',
        attachmentIds: [upload.body[0].id],
      })
      .expect(200);

    await request(helper.getHttpServer())
      .post('/api/documents')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        title: '重复绑定',
        content: '正文',
        attachmentIds: [upload.body[0].id],
      })
      .expect(409);
  });

  it('returns 409 for generic deletion of a document attachment', async () => {
    const upload = await uploadAttachment();
    const created = await request(helper.getHttpServer())
      .post('/api/documents')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        title: '通用删除',
        content: '正文',
        attachmentIds: [upload.body[0].id],
      })
      .expect(200);

    await request(helper.getHttpServer())
      .delete(`/api/attachments/${upload.body[0].id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(409);

    const attachment = await helper.dataSource
      .getRepository(Attachment)
      .findOne({
        where: { id: upload.body[0].id },
      });
    expect(attachment?.bizId).toBe(created.body.id);
  });

  it('rolls back the document when an attachment cannot be bound', async () => {
    const beforeCount = await helper.dataSource.getRepository(Document).count();

    await request(helper.getHttpServer())
      .post('/api/documents')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        title: '回滚',
        content: '正文',
        attachmentIds: ['999999999999999999'],
      })
      .expect(404);

    expect(await helper.dataSource.getRepository(Document).count()).toBe(
      beforeCount,
    );
  });

  it('soft deletes the document and its attachment metadata', async () => {
    const upload = await uploadAttachment();
    const created = await request(helper.getHttpServer())
      .post('/api/documents')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        title: '删除',
        content: '正文',
        attachmentIds: [upload.body[0].id],
      })
      .expect(200);

    await request(helper.getHttpServer())
      .delete(`/api/documents/${created.body.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const document = await helper.dataSource.getRepository(Document).findOne({
      where: { id: created.body.id },
      withDeleted: true,
    });
    const attachment = await helper.dataSource
      .getRepository(Attachment)
      .findOne({
        where: { id: upload.body[0].id },
        withDeleted: true,
      });

    expect(document?.deletedAt).toBeInstanceOf(Date);
    expect(attachment?.deletedAt).toBeInstanceOf(Date);
  });
});
