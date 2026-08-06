import { sql, type MigrateDownArgs, type MigrateUpArgs } from '@payloadcms/db-postgres'

/** Completes the existing Instagram product-tag tables with a stable media
 * identifier and optional per-product colour selections. The relationship
 * tables themselves were introduced by 20260805_110000. */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "instagram_spotlight_product_tags"
      ADD COLUMN IF NOT EXISTS "media_id" varchar,
      ADD COLUMN IF NOT EXISTS "variant_selections" jsonb;
    CREATE INDEX IF NOT EXISTS "instagram_spotlight_product_tags_media_id_idx"
      ON "instagram_spotlight_product_tags" ("media_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "instagram_spotlight_product_tags_media_id_idx";
    ALTER TABLE "instagram_spotlight_product_tags"
      DROP COLUMN IF EXISTS "media_id",
      DROP COLUMN IF EXISTS "variant_selections";
  `)
}
