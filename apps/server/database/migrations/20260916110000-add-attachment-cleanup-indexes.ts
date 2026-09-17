import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAttachmentCleanupIndexes20260916110000 implements MigrationInterface {
  name = 'AddAttachmentCleanupIndexes20260916110000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_attachments_biz"`);
    await queryRunner.query(
      `CREATE INDEX "IDX_attachments_cleanup_deleted" ON "attachments" ("deleted_at", "created_at", "id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_attachments_orphan_cleanup" ON "attachments" ("biz_type", "biz_id", "deleted_at", "created_at")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_attachments_orphan_cleanup"`);
    await queryRunner.query(`DROP INDEX "IDX_attachments_cleanup_deleted"`);
    await queryRunner.query(
      `CREATE INDEX "IDX_attachments_biz" ON "attachments" ("biz_type", "biz_id", "deleted_at")`,
    );
  }
}
