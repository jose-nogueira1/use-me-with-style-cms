import { sql, type MigrateDownArgs, type MigrateUpArgs } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "ai_draft_status" varchar;
    ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "ai_draft" text;
    ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "ai_draft_confidence" numeric;
    ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "ai_draft_source_record_ids" jsonb;
    ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "ai_draft_reason" varchar;
    ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "ai_bot_paused" boolean DEFAULT false;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "messages" DROP COLUMN IF EXISTS "ai_draft_status";
    ALTER TABLE "messages" DROP COLUMN IF EXISTS "ai_draft";
    ALTER TABLE "messages" DROP COLUMN IF EXISTS "ai_draft_confidence";
    ALTER TABLE "messages" DROP COLUMN IF EXISTS "ai_draft_source_record_ids";
    ALTER TABLE "messages" DROP COLUMN IF EXISTS "ai_draft_reason";
    ALTER TABLE "messages" DROP COLUMN IF EXISTS "ai_bot_paused";
  `)
}
