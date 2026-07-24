import { sql, type MigrateUpArgs, type MigrateDownArgs } from '@payloadcms/db-postgres'

// Makes the returns policy bilingual (PT/EN), matching the rest of the
// storefront's language toggle -- previously the client-provided legal copy
// was Portuguese-only and shown regardless of the selected language.
//
// `angolaReturnsPolicyText` / `portugalReturnsPolicyText` (added in
// 20260723_120000_returns_policy_per_market.ts) are renamed to the *PT
// variants -- a plain column rename, so the real client copy already saved
// in production carries forward untouched, no data migration needed. Two
// new *EN columns are added alongside for the English translation.
export async function up({ db, payload: _payload, req: _req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "market_settings" RENAME COLUMN "angola_returns_policy_text" TO "angola_returns_policy_text_pt";
  `)
  await db.execute(sql`
    ALTER TABLE "market_settings" RENAME COLUMN "portugal_returns_policy_text" TO "portugal_returns_policy_text_pt";
  `)
  await db.execute(sql`
    ALTER TABLE "market_settings"
      ADD COLUMN IF NOT EXISTS "angola_returns_policy_text_en" varchar,
      ADD COLUMN IF NOT EXISTS "portugal_returns_policy_text_en" varchar;
  `)
}

export async function down({ db, payload: _payload, req: _req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "market_settings"
      DROP COLUMN IF EXISTS "angola_returns_policy_text_en",
      DROP COLUMN IF EXISTS "portugal_returns_policy_text_en";
  `)
  await db.execute(sql`
    ALTER TABLE "market_settings" RENAME COLUMN "angola_returns_policy_text_pt" TO "angola_returns_policy_text";
  `)
  await db.execute(sql`
    ALTER TABLE "market_settings" RENAME COLUMN "portugal_returns_policy_text_pt" TO "portugal_returns_policy_text";
  `)
}
