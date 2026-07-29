import { sql, type MigrateDownArgs, type MigrateUpArgs } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "products"
      ADD COLUMN IF NOT EXISTS "shipping_weight_grams" numeric NOT NULL DEFAULT 500;
    ALTER TABLE "market_settings"
      ADD COLUMN IF NOT EXISTS "portugal_standard_weight_limit_grams" numeric NOT NULL DEFAULT 2000,
      ADD COLUMN IF NOT EXISTS "portugal_heavy_mainland_shipping_price" numeric NOT NULL DEFAULT 9.9,
      ADD COLUMN IF NOT EXISTS "portugal_heavy_islands_shipping_price" numeric NOT NULL DEFAULT 14.9;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "products" DROP COLUMN IF EXISTS "shipping_weight_grams";
    ALTER TABLE "market_settings"
      DROP COLUMN IF EXISTS "portugal_standard_weight_limit_grams",
      DROP COLUMN IF EXISTS "portugal_heavy_mainland_shipping_price",
      DROP COLUMN IF EXISTS "portugal_heavy_islands_shipping_price";
  `)
}
