import { sql, type MigrateDownArgs, type MigrateUpArgs } from '@payloadcms/db-postgres'

// T02: durable AI processing state lives on the inbound message so webhook
// retries and admin replies can coordinate without an in-memory queue.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "ai_processing_status" varchar;
    ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "ai_attempts" numeric DEFAULT 0;
    ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "ai_available_at" timestamptz;
    ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "ai_started_at" timestamptz;
    ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "ai_completed_at" timestamptz;
    ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "ai_cancelled_at" timestamptz;
    ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "ai_last_error" varchar;
    CREATE INDEX IF NOT EXISTS "messages_ai_job_lookup_idx"
      ON "messages" ("channel", "direction", "ai_processing_status", "ai_available_at");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "messages_ai_job_lookup_idx";
    ALTER TABLE "messages" DROP COLUMN IF EXISTS "ai_processing_status";
    ALTER TABLE "messages" DROP COLUMN IF EXISTS "ai_attempts";
    ALTER TABLE "messages" DROP COLUMN IF EXISTS "ai_available_at";
    ALTER TABLE "messages" DROP COLUMN IF EXISTS "ai_started_at";
    ALTER TABLE "messages" DROP COLUMN IF EXISTS "ai_completed_at";
    ALTER TABLE "messages" DROP COLUMN IF EXISTS "ai_cancelled_at";
    ALTER TABLE "messages" DROP COLUMN IF EXISTS "ai_last_error";
  `)
}
