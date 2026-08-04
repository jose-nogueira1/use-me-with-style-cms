import { sql, type MigrateUpArgs, type MigrateDownArgs } from '@payloadcms/db-postgres'

// VAT rates decision (2026-08-04, Jay-P): Angola is a flat 14% everywhere.
// Portugal is NOT flat -- mainland/Madeira/Azores each have their own legal
// rate (23% / 22% / 16%), so the single `vat_rate_p_t` column is replaced
// with three region-specific ones. See InvoiceSettings.ts's field comment
// for why the new PT columns are named `vat_rate_portugal_<region>` rather
// than stacking the market code against the region name.
//
// vat_rate_a_o already exists (added in 20260720_120500_internal_invoicing)
// and was never actually configured -- still sitting at its original
// default of 0. Backfilled to 14 here rather than relying on a Payload
// `defaultValue`, which only applies to new documents/rows, not this
// already-existing invoice-settings global row. Guarded so a value someone
// may already have set manually isn't silently overwritten.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    UPDATE "invoice_settings" SET "vat_rate_a_o" = 14 WHERE "vat_rate_a_o" IS NULL OR "vat_rate_a_o" = 0;

    ALTER TABLE "invoice_settings"
      ADD COLUMN IF NOT EXISTS "vat_rate_portugal_mainland" numeric DEFAULT 23,
      ADD COLUMN IF NOT EXISTS "vat_rate_portugal_madeira" numeric DEFAULT 22,
      ADD COLUMN IF NOT EXISTS "vat_rate_portugal_azores" numeric DEFAULT 16;

    ALTER TABLE "invoice_settings" DROP COLUMN IF EXISTS "vat_rate_p_t";
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "invoice_settings" ADD COLUMN IF NOT EXISTS "vat_rate_p_t" numeric DEFAULT 0;

    ALTER TABLE "invoice_settings"
      DROP COLUMN IF EXISTS "vat_rate_portugal_mainland",
      DROP COLUMN IF EXISTS "vat_rate_portugal_madeira",
      DROP COLUMN IF EXISTS "vat_rate_portugal_azores";
  `)
}
