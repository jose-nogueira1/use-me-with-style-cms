import { type MigrateDownArgs, type MigrateUpArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`ALTER TABLE "instagram_spotlight_rels" ADD COLUMN IF NOT EXISTS "products_id" integer`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "instagram_spotlight_rels_products_idx" ON "instagram_spotlight_rels" ("products_id")`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`ALTER TABLE "instagram_spotlight_rels" DROP COLUMN IF EXISTS "products_id"`)
}
