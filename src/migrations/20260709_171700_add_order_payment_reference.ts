import { sql, type MigrateUpArgs, type MigrateDownArgs } from '@payloadcms/db-postgres'

// Adds the `payment_reference` column to the `orders` table.
//
// Root cause (2026-07-09): the `paymentReference` field was added to the
// Orders collection in the "Add real Stripe + PayPal payment processing
// (JOS-61)" commit, but no migration was ever generated for it -- the only
// checked-in migration (20260708_220620_initial) is a no-op placeholder
// (see its comments), and production's real schema was created by hand
// against an earlier version of the collection. Result: every real checkout
// attempt in production failed with `column "payment_reference" of relation
// "orders" does not exist`, discovered while running a live end-to-end
// Stripe test order.
export async function up({ db, payload: _payload, req: _req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "payment_reference" varchar;
  `)
}

export async function down({ db, payload: _payload, req: _req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "orders" DROP COLUMN IF EXISTS "payment_reference";
  `)
}
