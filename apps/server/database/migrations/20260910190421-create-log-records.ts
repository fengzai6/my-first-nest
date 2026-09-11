import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateLogRecords20260910190421 implements MigrationInterface {
  name = 'CreateLogRecords20260910190421';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "log_records" (
        "id" bigint NOT NULL,
        "level" character varying(16) NOT NULL,
        "category" character varying(64) NOT NULL,
        "message" text NOT NULL,
        "context" jsonb,
        "request_id" character varying(64),
        "user_id" bigint,
        "ip" character varying(45),
        "method" character varying(10),
        "url" text,
        "status_code" smallint,
        "duration" integer,
        "stack" text,
        "timestamp" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "PK_log_records_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_log_records_timestamp" ON "log_records" ("timestamp")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_log_records_level_timestamp" ON "log_records" ("level", "timestamp")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_log_records_category_timestamp" ON "log_records" ("category", "timestamp")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_log_records_user_id_timestamp" ON "log_records" ("user_id", "timestamp")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_log_records_request_id" ON "log_records" ("request_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_log_records_request_id"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_log_records_user_id_timestamp"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_log_records_category_timestamp"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_log_records_level_timestamp"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_log_records_timestamp"`);
    await queryRunner.query(`DROP TABLE "log_records"`);
  }
}
