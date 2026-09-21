import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddActiveJobRunUniqueIndex20260919120000 implements MigrationInterface {
  name = 'AddActiveJobRunUniqueIndex20260919120000';

  public async up(queryRunner: QueryRunner): Promise<void> {
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
