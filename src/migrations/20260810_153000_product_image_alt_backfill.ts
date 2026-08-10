import { sql, type MigrateDownArgs, type MigrateUpArgs } from '@payloadcms/db-postgres'

/**
 * Backfill generic or blank product-media descriptions with the consistent
 * SEO pattern from audit item 11. Intentionally preserves any alt text that
 * an admin already made more specific than the product name.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    WITH image_context AS (
      SELECT DISTINCT ON (product_image."image_id")
        product_image."image_id",
        COALESCE(NULLIF(trim(product."name_p_t"), ''), NULLIF(trim(product."name"), ''), 'Produto') AS product_name,
        NULLIF(trim(colour."name_p_t"), '') AS colour_name,
        NULLIF(trim(category."name_p_t"), '') AS product_type
      FROM "products_images" product_image
      JOIN "products" product ON product."id" = product_image."_parent_id"
      LEFT JOIN "colors" colour ON colour."id" = product_image."color_id"
      LEFT JOIN "categories" category ON category."id" = product."category_id"
      WHERE product_image."image_id" IS NOT NULL
      ORDER BY product_image."image_id", product_image."_parent_id", product_image."_order"
    ), descriptive_alt AS (
      SELECT
        "image_id",
        product_name,
        concat_ws(' ', product_name, colour_name, product_type) || ' — Use Me With Style' AS alt
      FROM image_context
    )
    UPDATE "media" media
    SET "alt" = descriptive_alt.alt,
        "updated_at" = now()
    FROM descriptive_alt
    WHERE media."id" = descriptive_alt."image_id"
      AND (
        trim(COALESCE(media."alt", '')) = ''
        OR lower(trim(media."alt")) = lower(descriptive_alt.product_name)
      );
  `)
}

// Content corrections are deliberately not undone: restoring empty/generic
// accessibility text would recreate the production defect on rollback.
export async function down(_args: MigrateDownArgs): Promise<void> {}
