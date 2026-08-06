import { sql } from '@payloadcms/db-postgres'
import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-postgres'

/**
 * Generalises apparel-only colour/size inventory into stable variant rows,
 * adds fixed component-backed kits, customer-facing specifications and the
 * order snapshots required to reserve/release kit inventory safely.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "products"
      ADD COLUMN IF NOT EXISTS "product_type" varchar DEFAULT 'standard' NOT NULL,
      ADD COLUMN IF NOT EXISTS "option_label_p_t" varchar,
      ADD COLUMN IF NOT EXISTS "option_label_e_n" varchar,
      ADD COLUMN IF NOT EXISTS "return_eligible" boolean DEFAULT true,
      ADD COLUMN IF NOT EXISTS "return_note_p_t" varchar,
      ADD COLUMN IF NOT EXISTS "return_note_e_n" varchar;

    UPDATE "products"
      SET "option_label_p_t" = 'Tamanho', "option_label_e_n" = 'Size'
      WHERE "option_label_p_t" IS NULL;

    ALTER TABLE "products_variants" ALTER COLUMN "color_id" DROP NOT NULL;
    ALTER TABLE "products_variants" ALTER COLUMN "size" DROP NOT NULL;
    ALTER TABLE "products_variants" ALTER COLUMN "size" TYPE varchar USING "size"::text;
    ALTER TABLE "products_variants"
      ADD COLUMN IF NOT EXISTS "sku" varchar,
      ADD COLUMN IF NOT EXISTS "option_value_e_n" varchar;
    DROP TYPE IF EXISTS "enum_products_variants_size";

    CREATE TABLE IF NOT EXISTS "products_specifications" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "label_p_t" varchar NOT NULL,
      "label_e_n" varchar,
      "value_p_t" varchar NOT NULL,
      "value_e_n" varchar
    );
    CREATE INDEX IF NOT EXISTS "products_specifications_order_idx" ON "products_specifications" ("_order");
    CREATE INDEX IF NOT EXISTS "products_specifications_parent_id_idx" ON "products_specifications" ("_parent_id");
    DO $$ BEGIN
      ALTER TABLE "products_specifications" ADD CONSTRAINT "products_specifications_parent_id_fk"
        FOREIGN KEY ("_parent_id") REFERENCES "products"("id") ON DELETE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    CREATE TABLE IF NOT EXISTS "products_bundle_components" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "product_id" integer NOT NULL,
      "variant_id" varchar NOT NULL,
      "qty" numeric DEFAULT 1 NOT NULL
    );
    CREATE INDEX IF NOT EXISTS "products_bundle_components_order_idx" ON "products_bundle_components" ("_order");
    CREATE INDEX IF NOT EXISTS "products_bundle_components_parent_id_idx" ON "products_bundle_components" ("_parent_id");
    CREATE INDEX IF NOT EXISTS "products_bundle_components_product_idx" ON "products_bundle_components" ("product_id");
    DO $$ BEGIN
      ALTER TABLE "products_bundle_components" ADD CONSTRAINT "products_bundle_components_parent_id_fk"
        FOREIGN KEY ("_parent_id") REFERENCES "products"("id") ON DELETE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN
      ALTER TABLE "products_bundle_components" ADD CONSTRAINT "products_bundle_components_product_id_products_id_fk"
        FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    ALTER TABLE "orders_items"
      ADD COLUMN IF NOT EXISTS "variant_id" varchar,
      ADD COLUMN IF NOT EXISTS "option_label" varchar,
      ADD COLUMN IF NOT EXISTS "option_value" varchar,
      ADD COLUMN IF NOT EXISTS "product_type" varchar DEFAULT 'standard',
      ADD COLUMN IF NOT EXISTS "inventory_components" jsonb;
    ALTER TABLE "orders_items" ALTER COLUMN "size" DROP NOT NULL;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP TABLE IF EXISTS "products_bundle_components" CASCADE;
    DROP TABLE IF EXISTS "products_specifications" CASCADE;
    ALTER TABLE "orders_items"
      DROP COLUMN IF EXISTS "variant_id",
      DROP COLUMN IF EXISTS "option_label",
      DROP COLUMN IF EXISTS "option_value",
      DROP COLUMN IF EXISTS "product_type",
      DROP COLUMN IF EXISTS "inventory_components";
    ALTER TABLE "products_variants"
      DROP COLUMN IF EXISTS "sku",
      DROP COLUMN IF EXISTS "option_value_e_n";
    ALTER TABLE "products"
      DROP COLUMN IF EXISTS "product_type",
      DROP COLUMN IF EXISTS "option_label_p_t",
      DROP COLUMN IF EXISTS "option_label_e_n",
      DROP COLUMN IF EXISTS "return_eligible",
      DROP COLUMN IF EXISTS "return_note_p_t",
      DROP COLUMN IF EXISTS "return_note_e_n";
  `)
}
