import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAttachments20260913120000 implements MigrationInterface {
  name = 'CreateAttachments20260913120000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "attachments" (
        "id" bigint NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        "original_name" character varying(255) NOT NULL,
        "storage_key" character varying(500) NOT NULL,
        "mime_type" character varying(127) NOT NULL,
        "size" integer NOT NULL,
        "visibility" character varying(16) NOT NULL DEFAULT 'private',
        "storage_provider" character varying(32) NOT NULL DEFAULT 'local',
        "biz_type" character varying(64),
        "biz_id" bigint,
        "uploaded_by_id" bigint NOT NULL,
        CONSTRAINT "PK_attachments_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_attachments_storage_key" ON "attachments" ("storage_key")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_attachments_cleanup_deleted" ON "attachments" ("deleted_at", "created_at", "id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_attachments_orphan_cleanup" ON "attachments" ("biz_type", "biz_id", "deleted_at", "created_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_attachments_uploader" ON "attachments" ("uploaded_by_id", "visibility", "deleted_at")`,
    );
    await queryRunner.query(
      `ALTER TABLE "attachments" ADD CONSTRAINT "FK_attachments_uploaded_by" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "attachments" DROP CONSTRAINT "FK_attachments_uploaded_by"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_attachments_orphan_cleanup"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_attachments_cleanup_deleted"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_attachments_uploader"`);
    await queryRunner.query(`DROP INDEX "public"."UQ_attachments_storage_key"`);
    await queryRunner.query(`DROP TABLE "attachments"`);
  }
}
