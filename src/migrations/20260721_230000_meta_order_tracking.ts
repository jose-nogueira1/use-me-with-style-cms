import { type MigrateDownArgs, type MigrateUpArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "orders"
      ADD COLUMN IF NOT EXISTS "analytics_consent" boolean DEFAULT false,
      ADD COLUMN IF NOT EXISTS "meta_fbp" varchar,
      ADD COLUMN IF NOT EXISTS "meta_fbc" varchar,
      ADD COLUMN IF NOT EXISTS "meta_event_source_url" varchar;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "orders"
      DROP COLUMN IF EXISTS "meta_event_source_url",
      DROP COLUMN IF EXISTS "meta_fbc",
      DROP COLUMN IF EXISTS "meta_fbp",
      DROP COLUMN IF EXISTS "analytics_consent";
  `)
}
