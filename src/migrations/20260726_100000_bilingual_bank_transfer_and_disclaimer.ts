import { sql, type MigrateUpArgs, type MigrateDownArgs } from '@payloadcms/db-postgres'

// 2026-07-26 bilingual audit follow-up: splits two single-language fields
// that were silently showing the wrong language to customers into PT/EN
// pairs, same pattern as every other bilingual field in these two tables
// (returns policy, shipping info, issuer fields, etc.).
//
// - market_settings.angola_bank_transfer_instructions -> ..._p_t / ..._e_n
//   (Checkout.tsx's English-only fallback was shown to Angola's
//   Portuguese-default shoppers whenever this field's data was blank).
// - invoice_settings.phase_one_disclaimer -> ..._p_t / ..._e_n
//   (internalInvoice.ts's PDF renderer never varied by order.lang; this is
//   the first step of making that renderer bilingual).
//
// Column names verified against `to-snake-case` (the package Payload's
// Postgres adapter actually uses) before writing this migration -- same
// "_p_t"/"_e_n" trailing pattern as every prior PT/EN migration in this repo
// (see 20260724_150000's header comment for why that verification step
// matters here specifically).
export async function up({ db, payload: _payload, req: _req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "market_settings"
      ADD COLUMN IF NOT EXISTS "angola_bank_transfer_instructions_p_t" varchar,
      ADD COLUMN IF NOT EXISTS "angola_bank_transfer_instructions_e_n" varchar;

    UPDATE "market_settings"
      SET "angola_bank_transfer_instructions_p_t" = "angola_bank_transfer_instructions"
      WHERE "angola_bank_transfer_instructions" IS NOT NULL
        AND "angola_bank_transfer_instructions_p_t" IS NULL;

    ALTER TABLE "market_settings"
      DROP COLUMN IF EXISTS "angola_bank_transfer_instructions";

    ALTER TABLE "invoice_settings"
      ADD COLUMN IF NOT EXISTS "phase_one_disclaimer_p_t" varchar,
      ADD COLUMN IF NOT EXISTS "phase_one_disclaimer_e_n" varchar;

    UPDATE "invoice_settings"
      SET "phase_one_disclaimer_p_t" = COALESCE("phase_one_disclaimer_p_t", "phase_one_disclaimer",
        'Documento comercial interno, não certificado fiscalmente. Deve ser validado e tratado pelo contabilista da entidade emitente.'),
          "phase_one_disclaimer_e_n" = COALESCE("phase_one_disclaimer_e_n",
        'Internal commercial document, not fiscally certified. Must be validated and processed by the issuing entity''s accountant.');

    ALTER TABLE "invoice_settings"
      ALTER COLUMN "phase_one_disclaimer_p_t" SET NOT NULL,
      ALTER COLUMN "phase_one_disclaimer_e_n" SET NOT NULL,
      DROP COLUMN IF EXISTS "phase_one_disclaimer";
  `)
}

export async function down({ db, payload: _payload, req: _req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "market_settings"
      ADD COLUMN IF NOT EXISTS "angola_bank_transfer_instructions" varchar;

    UPDATE "market_settings"
      SET "angola_bank_transfer_instructions" = "angola_bank_transfer_instructions_p_t"
      WHERE "angola_bank_transfer_instructions_p_t" IS NOT NULL;

    ALTER TABLE "market_settings"
      DROP COLUMN IF EXISTS "angola_bank_transfer_instructions_p_t",
      DROP COLUMN IF EXISTS "angola_bank_transfer_instructions_e_n";

    ALTER TABLE "invoice_settings"
      ADD COLUMN IF NOT EXISTS "phase_one_disclaimer" varchar DEFAULT 'Documento comercial interno, não certificado fiscalmente. Deve ser validado e tratado pelo contabilista da entidade emitente.';

    UPDATE "invoice_settings"
      SET "phase_one_disclaimer" = "phase_one_disclaimer_p_t"
      WHERE "phase_one_disclaimer_p_t" IS NOT NULL;

    ALTER TABLE "invoice_settings"
      ALTER COLUMN "phase_one_disclaimer" SET NOT NULL,
      DROP COLUMN IF EXISTS "phase_one_disclaimer_p_t",
      DROP COLUMN IF EXISTS "phase_one_disclaimer_e_n";
  `)
}
