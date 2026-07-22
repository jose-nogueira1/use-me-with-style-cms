import { type MigrateDownArgs, type MigrateUpArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "products"
      ADD COLUMN IF NOT EXISTS "name_pt" varchar,
      ADD COLUMN IF NOT EXISTS "name_en" varchar,
      ADD COLUMN IF NOT EXISTS "description_pt" varchar,
      ADD COLUMN IF NOT EXISTS "description_en" varchar;

    UPDATE "products"
      SET "name_pt" = COALESCE("name_pt", "name"),
          "name_en" = COALESCE("name_en", "name"),
          "description_pt" = COALESCE("description_pt", "description");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "products"
      DROP COLUMN IF EXISTS "description_en",
      DROP COLUMN IF EXISTS "description_pt",
      DROP COLUMN IF EXISTS "name_en",
      DROP COLUMN IF EXISTS "name_pt";
  `)
}
