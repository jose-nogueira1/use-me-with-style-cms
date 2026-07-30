import { sql, type MigrateDownArgs, type MigrateUpArgs } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "invoice_settings"
      ADD COLUMN IF NOT EXISTS "bank_name_ao" varchar,
      ADD COLUMN IF NOT EXISTS "account_holder_ao" varchar,
      ADD COLUMN IF NOT EXISTS "bank_account_ao" varchar,
      ADD COLUMN IF NOT EXISTS "swift_bic_ao" varchar,
      ADD COLUMN IF NOT EXISTS "payment_instructions_ao" varchar,
      ADD COLUMN IF NOT EXISTS "bank_name_pt" varchar,
      ADD COLUMN IF NOT EXISTS "account_holder_pt" varchar,
      ADD COLUMN IF NOT EXISTS "bank_account_pt" varchar,
      ADD COLUMN IF NOT EXISTS "swift_bic_pt" varchar,
      ADD COLUMN IF NOT EXISTS "payment_instructions_pt" varchar;
    ALTER TABLE "invoices"
      ADD COLUMN IF NOT EXISTS "bank_name" varchar,
      ADD COLUMN IF NOT EXISTS "account_holder" varchar,
      ADD COLUMN IF NOT EXISTS "bank_account" varchar,
      ADD COLUMN IF NOT EXISTS "swift_bic" varchar,
      ADD COLUMN IF NOT EXISTS "payment_instructions" varchar;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "invoice_settings"
      DROP COLUMN IF EXISTS "bank_name_ao", DROP COLUMN IF EXISTS "account_holder_ao",
      DROP COLUMN IF EXISTS "bank_account_ao", DROP COLUMN IF EXISTS "swift_bic_ao",
      DROP COLUMN IF EXISTS "payment_instructions_ao", DROP COLUMN IF EXISTS "bank_name_pt",
      DROP COLUMN IF EXISTS "account_holder_pt", DROP COLUMN IF EXISTS "bank_account_pt",
      DROP COLUMN IF EXISTS "swift_bic_pt", DROP COLUMN IF EXISTS "payment_instructions_pt";
    ALTER TABLE "invoices"
      DROP COLUMN IF EXISTS "bank_name", DROP COLUMN IF EXISTS "account_holder",
      DROP COLUMN IF EXISTS "bank_account", DROP COLUMN IF EXISTS "swift_bic",
      DROP COLUMN IF EXISTS "payment_instructions";
  `)
}
