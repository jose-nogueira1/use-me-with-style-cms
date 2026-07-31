import { type MigrateUpArgs, sql } from '@payloadcms/db-postgres'

// Free delivery coupon type (2026-07-31 admin request: "let admins create a
// code that gives the customer free delivery"). coupons.type is a real
// Postgres ENUM (enum_coupons_type, created by 20260725_231500_coupons.ts)
// -- adding a value is additive and safe with existing rows/queries, no
// backfill needed since nothing can already have a value that didn't exist
// yet. See lib/couponPricing.ts's resolveCoupon for how this new value is
// interpreted (a shipping waiver, discountAmount always 0) and
// authoritativeOrder.ts for where it actually zeroes shippingCost.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TYPE "public"."enum_coupons_type" ADD VALUE IF NOT EXISTS 'free_shipping';
  `)
}

export async function down(): Promise<void> {
  // Postgres has no ALTER TYPE ... DROP VALUE -- removing an enum value
  // cleanly requires rebuilding the type (and every column using it) from
  // scratch. Not attempted here: same accepted trade-off this repo has used
  // before for enum growth (harmless to leave the value in the type even
  // when rolling back the app code that could produce it -- no existing row
  // can reference a value it was never able to select).
}
