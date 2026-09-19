import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddActiveJobRunUniqueIndex20260919120000 implements MigrationInterface {
  name = 'AddActiveJobRunUniqueIndex20260919120000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      WITH ranked_active_job_runs AS (
        SELECT
          "id",
          ROW_NUMBER() OVER (
            PARTITION BY "name"
            ORDER BY
              CASE "status"
                WHEN 'active' THEN 1
                WHEN 'delayed' THEN 2
                WHEN 'queued' THEN 3
              END,
              "created_at" ASC,
              "id" ASC
          ) AS "row_number"
        FROM "job_runs"
        WHERE "name" = 'cleanup-attachments'
          AND "status" IN ('queued', 'delayed', 'active')
      )
      UPDATE "job_runs" AS "job_run"
      SET
        "status" = 'cancelled',
        "finished_at" = COALESCE("job_run"."finished_at", NOW()),
        "updated_at" = NOW()
      FROM "ranked_active_job_runs" AS "ranked"
      WHERE "job_run"."id" = "ranked"."id"
        AND "ranked"."row_number" > 1
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_job_runs_cleanup_attachments_active" ON "job_runs" ("name") WHERE "name" = 'cleanup-attachments' AND "status" IN ('queued', 'delayed', 'active')`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "UQ_job_runs_cleanup_attachments_active"`,
    );
  }
}
