import { sql, type MigrateUpArgs, type MigrateDownArgs } from '@payloadcms/db-postgres'

// Splits the single `returnsPolicyText` field on the MarketSettings global
// into `angolaReturnsPolicyText` / `portugalReturnsPolicyText` (JOS-64).
// The two markets' legal text differ materially (Angola: 48h exchange-only
// window, no refunds; Portugal/EU: 14-day statutory withdrawal + refund) so
// this is a genuine content split, not a translation -- storing both under
// one field would make one market's checkout show the wrong policy.
//
// `returnsPolicyText` was a `textarea` field, which Payload's Postgres
// adapter maps to a plain `varchar` column (same pattern as
// `description_pt`/`description_en` in the product-localization migration),
// not an enum -- so this is a simple add/copy/drop, no custom Postgres type
// involved.
//
// Per JOS-64 / the 2026-07-22 audit, prod's `returns_policy_text` was still
// empty going into this change, but the migration copies forward any value
// that might exist rather than assuming that.
export async function up({ db, payload: _payload, req: _req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "market_settings"
      ADD COLUMN IF NOT EXISTS "angola_returns_policy_text" varchar,
      ADD COLUMN IF NOT EXISTS "portugal_returns_policy_text" varchar;
  `)
  await db.execute(sql`
    UPDATE "market_settings"
      SET "angola_returns_policy_text" = "returns_policy_text"
      WHERE "returns_policy_text" IS NOT NULL AND "angola_returns_policy_text" IS NULL;
  `)
  await db.execute(sql`
    ALTER TABLE "market_settings" DROP COLUMN IF EXISTS "returns_policy_text";
  `)
}

export async function down({ db, payload: _payload, req: _req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "market_settings" ADD COLUMN IF NOT EXISTS "returns_policy_text" varchar;
  `)
  await db.execute(sql`
    UPDATE "market_settings"
      SET "returns_policy_text" = "angola_returns_policy_text"
      WHERE "angola_returns_policy_text" IS NOT NULL;
  `)
  await db.execute(sql`
    ALTER TABLE "market_settings"
      DROP COLUMN IF EXISTS "angola_returns_policy_text",
      DROP COLUMN IF EXISTS "portugal_returns_policy_text";
  `)
}
