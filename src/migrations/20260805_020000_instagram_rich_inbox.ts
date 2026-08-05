import { sql, type MigrateDownArgs, type MigrateUpArgs } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "instagram_context_type" varchar;
    ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "instagram_context_url" varchar;
    ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "instagram_context_media_type" varchar;
    ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "reply_to_external_id" varchar;
    ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "reply_to_text" varchar;
    ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "internal_note" varchar;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "messages" DROP COLUMN IF EXISTS "internal_note";
    ALTER TABLE "messages" DROP COLUMN IF EXISTS "reply_to_text";
    ALTER TABLE "messages" DROP COLUMN IF EXISTS "reply_to_external_id";
    ALTER TABLE "messages" DROP COLUMN IF EXISTS "instagram_context_media_type";
    ALTER TABLE "messages" DROP COLUMN IF EXISTS "instagram_context_url";
    ALTER TABLE "messages" DROP COLUMN IF EXISTS "instagram_context_type";
  `)
}
