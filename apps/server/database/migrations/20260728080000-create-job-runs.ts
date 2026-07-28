import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateJobRuns20260728080000 implements MigrationInterface {
  name = 'CreateJobRuns20260728080000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "job_runs" (
        "id" bigint NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        "name" character varying(128) NOT NULL,
        "queue_name" character varying(64) NOT NULL DEFAULT 'default',
        "bull_job_id" character varying(128),
        "trigger_type" character varying(32) NOT NULL DEFAULT 'manual',
        "status" character varying(32) NOT NULL DEFAULT 'queued',
        "progress" integer NOT NULL DEFAULT 0,
        "payload" jsonb,
        "result" jsonb,
        "error_message" text,
        "attempts_made" integer NOT NULL DEFAULT 0,
        "max_attempts" integer NOT NULL DEFAULT 1,
        "started_at" TIMESTAMP WITH TIME ZONE,
        "finished_at" TIMESTAMP WITH TIME ZONE,
        "created_by" bigint,
        CONSTRAINT "PK_job_runs_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_job_runs_bull_job_id" ON "job_runs" ("bull_job_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_job_runs_status_created_at" ON "job_runs" ("status", "created_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_job_runs_name_created_at" ON "job_runs" ("name", "created_at")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_job_runs_name_created_at"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_job_runs_status_created_at"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_job_runs_bull_job_id"`);
    await queryRunner.query(`DROP TABLE "job_runs"`);
  }
}
