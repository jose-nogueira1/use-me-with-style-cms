import { type MigrateDownArgs, type MigrateUpArgs, sql } from '@payloadcms/db-postgres'

// Discounts phase 1 (2026-07-25): optional per-market sale price + optional
// date window, mirroring priceAOKz/pricePTEur. See lib/salePricing.ts.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "sale_a_o_kz" numeric;
    ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "sale_p_t_eur" numeric;
    ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "sale_start_date" timestamp(3) with time zone;
    ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "sale_end_date" timestamp(3) with time zone;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "products" DROP COLUMN IF EXISTS "sale_a_o_kz";
    ALTER TABLE "products" DROP COLUMN IF EXISTS "sale_p_t_eur";
    ALTER TABLE "products" DROP COLUMN IF EXISTS "sale_start_date";
    ALTER TABLE "products" DROP COLUMN IF EXISTS "sale_end_date";
  `)
}
