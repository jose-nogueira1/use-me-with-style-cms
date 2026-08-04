import { sql, type MigrateUpArgs, type MigrateDownArgs } from '@payloadcms/db-postgres'

// Portugal checkout no longer hard-blocks with an error while
// portugalPaymentsEnabled is off (2026-08-04, Jay-P request) -- it now
// offers a manual WhatsApp-coordination method instead, same pattern as
// Angola's existing bank-transfer fallback. These two bilingual instruction
// fields are the PT equivalent of angola_bank_transfer_instructions_p_t/
// _e_n (see 20260726_100000's migration for that field, including the
// "_p_t"/"_e_n" column-naming gotcha this migration follows).
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "market_settings"
      ADD COLUMN IF NOT EXISTS "portugal_manual_checkout_instructions_p_t" varchar,
      ADD COLUMN IF NOT EXISTS "portugal_manual_checkout_instructions_e_n" varchar;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "market_settings"
      DROP COLUMN IF EXISTS "portugal_manual_checkout_instructions_p_t",
      DROP COLUMN IF EXISTS "portugal_manual_checkout_instructions_e_n";
  `)
}
