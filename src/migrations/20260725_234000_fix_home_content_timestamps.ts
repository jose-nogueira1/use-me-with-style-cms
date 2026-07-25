import { type MigrateDownArgs, type MigrateUpArgs, sql } from '@payloadcms/db-postgres'

// Fixes another gap in 20260725_190000_home_content.ts: home_content's
// updated_at/created_at were created with DEFAULT now() but missing
// NOT NULL, and home_content_updated_at_idx/home_content_created_at_idx
// were never created at all -- unlike every other table's timestamp
// columns in this schema. Same root cause as the _home_content_v gap in
// 20260725_233000 (this global was hand-migrated once and missed the
// usual pattern); surfaced by local SQLite dev's schema-push wanting to
// rebuild the table on every boot until this was consistent.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "home_content" ALTER COLUMN "updated_at" SET NOT NULL;
    ALTER TABLE "home_content" ALTER COLUMN "created_at" SET NOT NULL;
    CREATE INDEX IF NOT EXISTS "home_content_updated_at_idx" ON "home_content" ("updated_at");
    CREATE INDEX IF NOT EXISTS "home_content_created_at_idx" ON "home_content" ("created_at");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "home_content_created_at_idx";
    DROP INDEX IF EXISTS "home_content_updated_at_idx";
    ALTER TABLE "home_content" ALTER COLUMN "updated_at" DROP NOT NULL;
    ALTER TABLE "home_content" ALTER COLUMN "created_at" DROP NOT NULL;
  `)
}
