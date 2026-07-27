import { type MigrateDownArgs, type MigrateUpArgs, sql } from '@payloadcms/db-postgres'

// Market scoping (2026-07-27, market-switch follow-up): a coupon previously
// had no explicit per-market gate -- see lib/couponPricing.ts's resolveCoupon
// for the new enforcement. Same boolean-default-true pattern as products'
// available_a_o/available_p_t (20260718_183031).
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "coupons"
      ADD COLUMN IF NOT EXISTS "available_a_o" boolean DEFAULT true,
      ADD COLUMN IF NOT EXISTS "available_p_t" boolean DEFAULT true;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "coupons"
      DROP COLUMN IF EXISTS "available_a_o",
      DROP COLUMN IF EXISTS "available_p_t";
  `)
}
