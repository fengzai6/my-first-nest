import { Injectable } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import { AppConfigForced } from '@/config/configuration.interface';

@Injectable()
export class AttachmentSignatureService {
  private readonly secret: string;
  private readonly expiresIn: number;
  private readonly urlPrefix: string;

  constructor(config: AppConfigForced) {
    if (!config.upload.secret) {
      throw new Error('UPLOAD_SIGNATURE_SECRET is required');
    }

    this.secret = config.upload.secret;
    this.expiresIn = config.upload.signedUrlExpiresIn;
    this.urlPrefix = config.upload.urlPrefix;
  }

  createSignedUrl(
    attachmentId: string,
    userId: string,
  ): { url: string; expiresAt: number } {
    const expiresAt = Date.now() + this.expiresIn * 1000;
    const signature = this.sign(attachmentId, userId, expiresAt);
    const params = new URLSearchParams({
      expiresAt: String(expiresAt),
      userId,
      signature,
    });

    return {
      url: `${this.urlPrefix}/${attachmentId}?${params.toString()}`,
      expiresAt,
    };
  }

  verifySignature(
    attachmentId: string,
    userId: string,
    expiresAt: number,
    signature: string,
  ): boolean {
    if (!Number.isSafeInteger(expiresAt) || expiresAt <= Date.now()) {
      return false;
    }

    const expected = this.sign(attachmentId, userId, expiresAt);
    const expectedBuffer = Buffer.from(expected);
    const actualBuffer = Buffer.from(signature);

    if (expectedBuffer.length !== actualBuffer.length) {
      return false;
    }

    return timingSafeEqual(expectedBuffer, actualBuffer);
  }

  getExpiresIn(): number {
    return this.expiresIn;
  }

  getUrlPrefix(): string {
    return this.urlPrefix;
  }

  private sign(attachmentId: string, userId: string, expiresAt: number) {
    return createHmac('sha256', this.secret)
      .update(`${attachmentId}.${userId}.${expiresAt}`)
      .digest('base64url');
  }
}
