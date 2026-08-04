import { type MigrateDownArgs, type MigrateUpArgs, sql } from '@payloadcms/db-postgres'

// Checkout now collects first/last name as two separate inputs (2026-08-04,
// Jay-P request) instead of one free-text "Name" box. `customer_name`
// remains the combined value and is still what every existing consumer
// (admin order list/search, invoice PDFs, confirmation emails) reads --
// these two new columns are additive, optional snapshot fields alongside it
// for future use (e.g. a shipping-label API that wants them split
// separately). Nullable: existing order rows have no first/last name to
// backfill, and nothing requires one going forward at the DB level --
// Payload's own `required` (if ever set) is an application-layer check, not
// a NOT NULL constraint added here.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "customer_first_name" varchar;
    ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "customer_last_name" varchar;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "orders" DROP COLUMN IF EXISTS "customer_first_name";
    ALTER TABLE "orders" DROP COLUMN IF EXISTS "customer_last_name";
  `)
}
