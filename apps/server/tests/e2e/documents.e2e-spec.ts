import { RoleCode } from '@/common/constants/roles';
import { Attachment } from '@/modules/attachments/entities/attachment.entity';
import { Document } from '@/modules/documents/entities/document.entity';
import { User } from '@/modules/users/entities/user.entity';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { TestHelper } from './helpers/test-helper';

interface IUploadedAttachmentResponse {
  id: string;
}

interface IDocumentAttachmentResponse {
  id: string;
  url: string;
}

interface IDocumentResponse {
  id: string;
  owner: { id: string };
  attachments: IDocumentAttachmentResponse[];
}

interface ISignedUrlResponse {
  url: string;
  expiresAt: number;
}

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

  const uploadAttachment = async ({
    filename = 'image.png',
    contentType = 'image/png',
    visibility,
  }: {
    filename?: string;
    contentType?: string;
    visibility?: 'private' | 'public';
  } = {}) =>
    request(helper.getHttpServer())
      .post('/api/attachments')
      .set('Authorization', `Bearer ${accessToken}`)
      .field('visibility', visibility ?? 'private')
      .attach('files', Buffer.from('image'), {
        filename,
        contentType,
      })
      .expect(200);

  it('creates a document with an uploaded private attachment', async () => {
    const upload = await uploadAttachment();
    const uploadedAttachment = (
      upload.body as IUploadedAttachmentResponse[]
    )[0];

    const created = await request(helper.getHttpServer())
      .post('/api/documents')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        title: '附件闭环',
        content: '测试正文',
        attachmentIds: [uploadedAttachment.id],
      })
      .expect(200);
    const createdDocument = created.body as IDocumentResponse;

    expect(createdDocument.attachments).toHaveLength(1);
    expect(createdDocument.attachments[0]).toMatchObject({
      id: uploadedAttachment.id,
      bizType: 'document',
      bizId: createdDocument.id,
    });
  });

  it('lets the document owner get a private attachment signed url', async () => {
    const upload = await uploadAttachment();
    const uploadedAttachment = (
      upload.body as IUploadedAttachmentResponse[]
    )[0];
    const created = await request(helper.getHttpServer())
      .post('/api/documents')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        title: '签名',
        content: '正文',
        attachmentIds: [uploadedAttachment.id],
      })
      .expect(200);
    const createdDocument = created.body as IDocumentResponse;

    const response = await request(helper.getHttpServer())
      .get(
        `/api/documents/${createdDocument.id}/attachments/${uploadedAttachment.id}/signed-url`,
      )
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    const signedUrl = response.body as ISignedUrlResponse;

    expect(signedUrl.url).toContain('/api/attachments/content/');
    expect(signedUrl.expiresAt).toEqual(expect.any(Number));
  });

  it('downloads a private attachment with a signed url and encoded filename', async () => {
    const originalName = '资料 报告 (最终).pdf';
    const upload = await uploadAttachment({
      filename: originalName,
      contentType: 'application/pdf',
    });
    const uploadedAttachment = (
      upload.body as IUploadedAttachmentResponse[]
    )[0];
    const created = await request(helper.getHttpServer())
      .post('/api/documents')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        title: '下载',
        content: '正文',
        attachmentIds: [uploadedAttachment.id],
      })
      .expect(200);
    const createdDocument = created.body as IDocumentResponse;

    const signed = await request(helper.getHttpServer())
      .get(
        `/api/documents/${createdDocument.id}/attachments/${uploadedAttachment.id}/signed-url`,
      )
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    const signedUrl = signed.body as ISignedUrlResponse;

    const response = await request(helper.getHttpServer())
      .get(signedUrl.url)
      .query({ download: '1' })
      .expect(200);

    expect(response.headers['content-type']).toContain('application/pdf');
    expect(response.headers['content-disposition']).toBe(
      "attachment; filename*=UTF-8''%E8%B5%84%E6%96%99%20%E6%8A%A5%E5%91%8A%20%28%E6%9C%80%E7%BB%88%29.pdf",
    );
  });

  it('downloads a public attachment without a signature', async () => {
    const originalName = '公开 报告.pdf';
    const upload = await uploadAttachment({
      filename: originalName,
      contentType: 'application/pdf',
      visibility: 'public',
    });
    const uploadedAttachment = (
      upload.body as IUploadedAttachmentResponse[]
    )[0];
    const created = await request(helper.getHttpServer())
      .post('/api/documents')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        title: '公开下载',
        content: '正文',
        attachmentIds: [uploadedAttachment.id],
      })
      .expect(200);
    const createdDocument = created.body as IDocumentResponse;

    const response = await request(helper.getHttpServer())
      .get(createdDocument.attachments[0].url)
      .query({ download: '1' })
      .expect(200);

    expect(response.headers['content-type']).toContain('application/pdf');
    expect(response.headers['content-disposition']).toBe(
      "attachment; filename*=UTF-8''%E5%85%AC%E5%BC%80%20%E6%8A%A5%E5%91%8A.pdf",
    );
  });

  it('keeps inline disposition when download is not requested', async () => {
    const originalName = '资料 预览.pdf';
    const upload = await uploadAttachment({
      filename: originalName,
      contentType: 'application/pdf',
    });
    const uploadedAttachment = (
      upload.body as IUploadedAttachmentResponse[]
    )[0];
    const created = await request(helper.getHttpServer())
      .post('/api/documents')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        title: '预览',
        content: '正文',
        attachmentIds: [uploadedAttachment.id],
      })
      .expect(200);
    const createdDocument = created.body as IDocumentResponse;

    const signed = await request(helper.getHttpServer())
      .get(
        `/api/documents/${createdDocument.id}/attachments/${uploadedAttachment.id}/signed-url`,
      )
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    const signedUrl = signed.body as ISignedUrlResponse;

    const response = await request(helper.getHttpServer())
      .get(signedUrl.url)
      .expect(200);

    expect(response.headers['content-disposition']).toBe(
      "inline; filename*=UTF-8''%E8%B5%84%E6%96%99%20%E9%A2%84%E8%A7%88.pdf",
    );
  });

  it('rejects private downloads without a complete signature', async () => {
    const upload = await uploadAttachment();
    const uploadedAttachment = (
      upload.body as IUploadedAttachmentResponse[]
    )[0];
    const created = await request(helper.getHttpServer())
      .post('/api/documents')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        title: '签名校验',
        content: '正文',
        attachmentIds: [uploadedAttachment.id],
      })
      .expect(200);
    const createdDocument = created.body as IDocumentResponse;

    await request(helper.getHttpServer())
      .get(`/api/attachments/content/${uploadedAttachment.id}`)
      .query({ download: '1' })
      .expect(403);

    await request(helper.getHttpServer())
      .get(`/api/attachments/content/${uploadedAttachment.id}`)
      .query({ download: '1', userId: createdDocument.owner.id })
      .expect(403);
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

  it('keeps documents readable after the owner is soft deleted', async () => {
    const created = await request(helper.getHttpServer())
      .post('/api/documents')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ title: '已删除 owner', content: '正文' })
      .expect(200);

    const profile = await request(helper.getHttpServer())
      .get('/api/account/profile')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    const owner = await helper.dataSource
      .getRepository(User)
      .findOneByOrFail({ id: profile.body.id });

    await helper.dataSource.getRepository(User).softRemove(owner);

    const response = await request(helper.getHttpServer())
      .get(`/api/documents/${created.body.id}`)
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .expect(200);

    expect(response.body.owner).toMatchObject({
      id: profile.body.id,
      displayName: 'document-user',
    });
  });

  it('updates additions, keeps existing attachments, and removes old ones', async () => {
    const firstUpload = await uploadAttachment();
    const secondUpload = await uploadAttachment();
    const thirdUpload = await uploadAttachment();
    const firstAttachment = (
      firstUpload.body as IUploadedAttachmentResponse[]
    )[0];
    const secondAttachment = (
      secondUpload.body as IUploadedAttachmentResponse[]
    )[0];
    const thirdAttachment = (
      thirdUpload.body as IUploadedAttachmentResponse[]
    )[0];
    const created = await request(helper.getHttpServer())
      .post('/api/documents')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        title: '附件更新',
        content: '正文',
        attachmentIds: [firstAttachment.id, secondAttachment.id],
      })
      .expect(200);
    const createdDocument = created.body as IDocumentResponse;

    const updated = await request(helper.getHttpServer())
      .patch(`/api/documents/${createdDocument.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        attachmentIds: [secondAttachment.id, thirdAttachment.id],
      })
      .expect(200);
    const updatedDocument = updated.body as IDocumentResponse;

    expect(updatedDocument.attachments.map((item) => item.id)).toEqual(
      expect.arrayContaining([secondAttachment.id, thirdAttachment.id]),
    );
    expect(updatedDocument.attachments).toHaveLength(2);

    const removed = await helper.dataSource.getRepository(Attachment).findOne({
      where: { id: firstAttachment.id },
      withDeleted: true,
    });
    expect(removed?.deletedAt).toBeInstanceOf(Date);
  });

  it('returns 409 for an attachment already bound to another business object', async () => {
    const upload = await uploadAttachment();
    const uploadedAttachment = (
      upload.body as IUploadedAttachmentResponse[]
    )[0];
    await request(helper.getHttpServer())
      .post('/api/documents')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        title: '首次绑定',
        content: '正文',
        attachmentIds: [uploadedAttachment.id],
      })
      .expect(200);

    await request(helper.getHttpServer())
      .post('/api/documents')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        title: '重复绑定',
        content: '正文',
        attachmentIds: [uploadedAttachment.id],
      })
      .expect(409);
  });

  it('returns 409 for generic deletion of a document attachment', async () => {
    const upload = await uploadAttachment();
    const uploadedAttachment = (
      upload.body as IUploadedAttachmentResponse[]
    )[0];
    const created = await request(helper.getHttpServer())
      .post('/api/documents')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        title: '通用删除',
        content: '正文',
        attachmentIds: [uploadedAttachment.id],
      })
      .expect(200);
    const createdDocument = created.body as IDocumentResponse;

    await request(helper.getHttpServer())
      .delete(`/api/attachments/${uploadedAttachment.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(409);

    const attachment = await helper.dataSource
      .getRepository(Attachment)
      .findOne({
        where: { id: uploadedAttachment.id },
      });
    expect(attachment?.bizId).toBe(createdDocument.id);
  });

  it('returns 409 when generic update includes a business binding field', async () => {
    const upload = await uploadAttachment();
    const uploadedAttachment = (
      upload.body as IUploadedAttachmentResponse[]
    )[0];
    const created = await request(helper.getHttpServer())
      .post('/api/documents')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        title: '通用更新',
        content: '正文',
        attachmentIds: [uploadedAttachment.id],
      })
      .expect(200);
    const createdDocument = created.body as IDocumentResponse;

    await request(helper.getHttpServer())
      .patch(`/api/attachments/${uploadedAttachment.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        visibility: 'public',
        bizId: 'invalid-biz-id',
      })
      .expect(409);

    const attachment = await helper.dataSource
      .getRepository(Attachment)
      .findOne({ where: { id: uploadedAttachment.id } });
    expect(attachment?.bizId).toBe(createdDocument.id);
    expect(attachment?.visibility).toBe('private');
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
    const uploadedAttachment = (
      upload.body as IUploadedAttachmentResponse[]
    )[0];
    const created = await request(helper.getHttpServer())
      .post('/api/documents')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        title: '删除',
        content: '正文',
        attachmentIds: [uploadedAttachment.id],
      })
      .expect(200);
    const createdDocument = created.body as IDocumentResponse;

    await request(helper.getHttpServer())
      .delete(`/api/documents/${createdDocument.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const document = await helper.dataSource.getRepository(Document).findOne({
      where: { id: createdDocument.id },
      withDeleted: true,
    });
    const attachment = await helper.dataSource
      .getRepository(Attachment)
      .findOne({
        where: { id: uploadedAttachment.id },
        withDeleted: true,
      });

    expect(document?.deletedAt).toBeInstanceOf(Date);
    expect(attachment?.deletedAt).toBeInstanceOf(Date);
  });
});
