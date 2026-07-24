import { sql, type MigrateUpArgs, type MigrateDownArgs } from '@payloadcms/db-postgres'

// Hotfix for a naming bug in 20260724_130000_bilingual_returns_policy.ts:
// that migration renamed/added columns assuming Payload's Postgres adapter
// converts a trailing two-letter acronym like `...TextPT` to `..._text_pt`
// (matching the existing `namePT`/`nameEN` product fields, which do use a
// single underscore: `name_pt`, `name_en`). That assumption was wrong for
// this field -- the runtime query Payload actually issues asks for
// `angola_returns_policy_text_p_t` / `..._e_n` (an underscore between every
// acronym letter), confirmed from the live "column ... does not exist"
// error in production logs immediately after the previous migration
// deployed. This broke the market-settings global entirely in prod (500 on
// every read), which the storefront's checkout also depends on.
//
// This migration renames the columns to what Payload actually expects. No
// data loss: straight renames of columns that had just been created/renamed
// moments earlier in the previous migration (the client's real PT copy,
// carried forward from before, survives this rename too).
export async function up({ db, payload: _payload, req: _req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "market_settings" RENAME COLUMN "angola_returns_policy_text_pt" TO "angola_returns_policy_text_p_t";
  `)
  await db.execute(sql`
    ALTER TABLE "market_settings" RENAME COLUMN "angola_returns_policy_text_en" TO "angola_returns_policy_text_e_n";
  `)
  await db.execute(sql`
    ALTER TABLE "market_settings" RENAME COLUMN "portugal_returns_policy_text_pt" TO "portugal_returns_policy_text_p_t";
  `)
  await db.execute(sql`
    ALTER TABLE "market_settings" RENAME COLUMN "portugal_returns_policy_text_en" TO "portugal_returns_policy_text_e_n";
  `)
}

export async function down({ db, payload: _payload, req: _req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "market_settings" RENAME COLUMN "angola_returns_policy_text_p_t" TO "angola_returns_policy_text_pt";
  `)
  await db.execute(sql`
    ALTER TABLE "market_settings" RENAME COLUMN "angola_returns_policy_text_e_n" TO "angola_returns_policy_text_en";
  `)
  await db.execute(sql`
    ALTER TABLE "market_settings" RENAME COLUMN "portugal_returns_policy_text_p_t" TO "portugal_returns_policy_text_pt";
  `)
  await db.execute(sql`
    ALTER TABLE "market_settings" RENAME COLUMN "portugal_returns_policy_text_e_n" TO "portugal_returns_policy_text_en";
  `)
}
