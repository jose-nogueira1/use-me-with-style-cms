import { sql } from '@payloadcms/db-postgres'
import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-postgres'

/**
 * Per-colour product photo galleries (2026-08-07): adds an optional `color`
 * relationship to each row of Products.images, mirroring
 * products_variants.color_id (see 20260725_150000_catalogue_taxonomies.ts).
 * Nullable on purpose -- every image uploaded before this field existed
 * keeps its NULL colour, which the storefront treats as "general" (shown
 * regardless of which colour the shopper has selected).
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "products_images" ADD COLUMN IF NOT EXISTS "color_id" integer;
    CREATE INDEX IF NOT EXISTS "products_images_color_idx" ON "products_images" ("color_id");
    DO $$ BEGIN
      ALTER TABLE "products_images" ADD CONSTRAINT "products_images_color_id_colors_id_fk"
        FOREIGN KEY ("color_id") REFERENCES "colors"("id") ON DELETE SET NULL;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "products_images" DROP CONSTRAINT IF EXISTS "products_images_color_id_colors_id_fk";
    DROP INDEX IF EXISTS "products_images_color_idx";
    ALTER TABLE "products_images" DROP COLUMN IF EXISTS "color_id";
  `)
}
