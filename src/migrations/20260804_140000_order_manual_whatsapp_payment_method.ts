import { type MigrateDownArgs, type MigrateUpArgs, sql } from '@payloadcms/db-postgres'

// New payment-method value for the Portugal manual-WhatsApp checkout
// fallback (2026-08-04) -- see authoritativeOrder.ts and Orders.ts's
// PAYMENT_METHODS. Same ADD VALUE pattern already used in this repo for
// 'multicaixa_express' (20260718_183031.ts) -- Postgres enum values can't be
// removed by ALTER TYPE, so `down` is a documented no-op like that
// migration's equivalent case, not a real reversal.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TYPE "public"."enum_orders_payment_method"
      ADD VALUE IF NOT EXISTS 'manual_whatsapp';
  `)
}

export async function down({ db: _db }: MigrateDownArgs): Promise<void> {
  // No-op: Postgres does not support removing a value from an existing
  // enum type. Any 'manual_whatsapp' order rows would need to be
  // reassigned to another payment method before the value itself could be
  // dropped, which isn't something a migration should do silently.
}
