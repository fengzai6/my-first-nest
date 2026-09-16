import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateDocuments20260916100000 implements MigrationInterface {
  name = 'CreateDocuments20260916100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "documents" (
        "id" bigint NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        "title" character varying(200) NOT NULL,
        "content" text NOT NULL,
        "status" character varying(16) NOT NULL DEFAULT 'draft',
        "owner_id" bigint NOT NULL,
        CONSTRAINT "PK_documents_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_documents_owner_created" ON "documents" ("owner_id", "deleted_at", "created_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_documents_status_created" ON "documents" ("status", "deleted_at", "created_at")`,
    );
    await queryRunner.query(
      `ALTER TABLE "documents" ADD CONSTRAINT "FK_documents_owner" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "documents" DROP CONSTRAINT "FK_documents_owner"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_documents_status_created"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_documents_owner_created"`,
    );
    await queryRunner.query(`DROP TABLE "documents"`);
  }
}
