import { sql, type MigrateDownArgs, type MigrateUpArgs } from '@payloadcms/db-postgres'

// The first production migration used _ao/_pt, but Payload's to-snake-case
// mapping expands capital-letter suffixes to _a_o/_p_t. Keep the original
// migration correct for fresh schemas and repair databases that already ran it.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "invoice_settings"
      ADD COLUMN IF NOT EXISTS "bank_name_a_o" varchar,
      ADD COLUMN IF NOT EXISTS "account_holder_a_o" varchar,
      ADD COLUMN IF NOT EXISTS "bank_account_a_o" varchar,
      ADD COLUMN IF NOT EXISTS "swift_bic_a_o" varchar,
      ADD COLUMN IF NOT EXISTS "payment_instructions_a_o" varchar,
      ADD COLUMN IF NOT EXISTS "bank_name_p_t" varchar,
      ADD COLUMN IF NOT EXISTS "account_holder_p_t" varchar,
      ADD COLUMN IF NOT EXISTS "bank_account_p_t" varchar,
      ADD COLUMN IF NOT EXISTS "swift_bic_p_t" varchar,
      ADD COLUMN IF NOT EXISTS "payment_instructions_p_t" varchar;

    ALTER TABLE "invoice_settings"
      DROP COLUMN IF EXISTS "bank_name_ao", DROP COLUMN IF EXISTS "account_holder_ao",
      DROP COLUMN IF EXISTS "bank_account_ao", DROP COLUMN IF EXISTS "swift_bic_ao",
      DROP COLUMN IF EXISTS "payment_instructions_ao", DROP COLUMN IF EXISTS "bank_name_pt",
      DROP COLUMN IF EXISTS "account_holder_pt", DROP COLUMN IF EXISTS "bank_account_pt",
      DROP COLUMN IF EXISTS "swift_bic_pt", DROP COLUMN IF EXISTS "payment_instructions_pt";
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "invoice_settings"
      DROP COLUMN IF EXISTS "bank_name_a_o", DROP COLUMN IF EXISTS "account_holder_a_o",
      DROP COLUMN IF EXISTS "bank_account_a_o", DROP COLUMN IF EXISTS "swift_bic_a_o",
      DROP COLUMN IF EXISTS "payment_instructions_a_o", DROP COLUMN IF EXISTS "bank_name_p_t",
      DROP COLUMN IF EXISTS "account_holder_p_t", DROP COLUMN IF EXISTS "bank_account_p_t",
      DROP COLUMN IF EXISTS "swift_bic_p_t", DROP COLUMN IF EXISTS "payment_instructions_p_t";
  `)
}
