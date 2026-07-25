import { type MigrateDownArgs, type MigrateUpArgs, sql } from '@payloadcms/db-postgres'

// Discounts phase 2 (2026-07-25): snapshot fields on Orders -- see
// authoritativeOrder.ts. couponCode/discountAmount/discountLabel are always
// computed server-side from resolveCoupon(), never trusted from the client.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "coupon_code" varchar;
    ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "discount_amount" numeric DEFAULT 0;
    ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "discount_label" varchar;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "orders" DROP COLUMN IF EXISTS "discount_label";
    ALTER TABLE "orders" DROP COLUMN IF EXISTS "discount_amount";
    ALTER TABLE "orders" DROP COLUMN IF EXISTS "coupon_code";
  `)
}
