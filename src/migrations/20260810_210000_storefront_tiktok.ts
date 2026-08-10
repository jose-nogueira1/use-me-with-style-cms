import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "storefront_content"
      ADD COLUMN IF NOT EXISTS "tiktok_url" varchar;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "storefront_content"
      DROP COLUMN IF EXISTS "tiktok_url";
  `)
}
