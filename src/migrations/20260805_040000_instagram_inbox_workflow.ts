import { sql, type MigrateDownArgs, type MigrateUpArgs } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "admin_read_at" timestamp(3) with time zone;
    ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "instagram_seen_at" timestamp(3) with time zone;
    ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "conversation_status" varchar DEFAULT 'needs_reply';

    -- Existing history predates both the local unread model and the new
    -- workflow. Start it read + done so deployment cannot manufacture a
    -- false support backlog. The next real inbound webhook reopens that
    -- conversation as needs_reply; the next outbound echo makes it waiting.
    UPDATE "messages" SET "conversation_status" = 'done';
    UPDATE "messages" SET "admin_read_at" = NOW()
    WHERE "direction" = 'inbound' AND "admin_read_at" IS NULL;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "messages" DROP COLUMN IF EXISTS "conversation_status";
    ALTER TABLE "messages" DROP COLUMN IF EXISTS "instagram_seen_at";
    ALTER TABLE "messages" DROP COLUMN IF EXISTS "admin_read_at";
  `)
}
