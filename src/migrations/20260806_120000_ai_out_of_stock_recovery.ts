import { sql, type MigrateDownArgs, type MigrateUpArgs } from '@payloadcms/db-postgres'

/** Administrator controls for verified out-of-stock recommendations. */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "ai_messaging_settings"
      ADD COLUMN IF NOT EXISTS "out_of_stock_recovery_enabled" boolean DEFAULT true,
      ADD COLUMN IF NOT EXISTS "out_of_stock_allow_other_colours" boolean DEFAULT true,
      ADD COLUMN IF NOT EXISTS "out_of_stock_allow_other_sizes" boolean DEFAULT true,
      ADD COLUMN IF NOT EXISTS "out_of_stock_max_alternatives" numeric DEFAULT 3 NOT NULL,
      ADD COLUMN IF NOT EXISTS "out_of_stock_price_tolerance_percent" numeric DEFAULT 25 NOT NULL,
      ADD COLUMN IF NOT EXISTS "out_of_stock_category_weight" numeric DEFAULT 60 NOT NULL,
      ADD COLUMN IF NOT EXISTS "out_of_stock_tag_weight" numeric DEFAULT 40 NOT NULL;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "ai_messaging_settings"
      DROP COLUMN IF EXISTS "out_of_stock_recovery_enabled",
      DROP COLUMN IF EXISTS "out_of_stock_allow_other_colours",
      DROP COLUMN IF EXISTS "out_of_stock_allow_other_sizes",
      DROP COLUMN IF EXISTS "out_of_stock_max_alternatives",
      DROP COLUMN IF EXISTS "out_of_stock_price_tolerance_percent",
      DROP COLUMN IF EXISTS "out_of_stock_category_weight",
      DROP COLUMN IF EXISTS "out_of_stock_tag_weight";
  `)
}
