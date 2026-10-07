import { sql, type MigrateUpArgs, type MigrateDownArgs } from '@payloadcms/db-postgres'

// Storefront announcement bar: a new single-row global for the free-delivery
// message, plus "show on the announcement bar" fields on coupons. All additive.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "announcement_banner" (
      "id" serial PRIMARY KEY NOT NULL,
      "angola_delivery_enabled" boolean DEFAULT true,
      "angola_delivery_text_pt" varchar,
      "angola_delivery_text_en" varchar,
      "portugal_delivery_enabled" boolean DEFAULT true,
      "portugal_delivery_text_pt" varchar,
      "portugal_delivery_text_en" varchar,
      "updated_at" timestamp(3) with time zone DEFAULT now(),
      "created_at" timestamp(3) with time zone DEFAULT now()
    );

    ALTER TABLE "coupons"
      ADD COLUMN IF NOT EXISTS "show_on_banner" boolean DEFAULT false,
      ADD COLUMN IF NOT EXISTS "banner_text_pt" varchar,
      ADD COLUMN IF NOT EXISTS "banner_text_en" varchar;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "coupons"
      DROP COLUMN IF EXISTS "banner_text_en",
      DROP COLUMN IF EXISTS "banner_text_pt",
      DROP COLUMN IF EXISTS "show_on_banner";
    DROP TABLE IF EXISTS "announcement_banner" CASCADE;
  `)
}
