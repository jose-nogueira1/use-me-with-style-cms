import { sql, type MigrateUpArgs, type MigrateDownArgs } from '@payloadcms/db-postgres'

// Adds business hours + shipping/delivery info fields to MarketSettings
// (JOS-64 follow-up, client copy provided 2026-07-24). Bilingual PT/EN, same
// pattern as the returns policy fields.
//
// Column names were verified BEFORE writing this migration by running the
// same `to-snake-case` package Payload's Postgres adapter actually uses
// (`node -e "require('to-snake-case')('businessHoursTextPT')"` etc.) --
// confirmed each trailing PT/EN suffix maps to `_p_t`/`_e_n` (underscore
// between every acronym letter), not `_pt`/`_en`. This is the same bug that
// broke market-settings in prod earlier today (20260724_130000 assumed the
// single-underscore form) and that had already bitten the product
// namePT/nameEN fields before that (see
// 20260722_152800_fix_product_localization_columns.ts) -- verifying against
// the real conversion function up front instead of guessing by analogy.
export async function up({ db, payload: _payload, req: _req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "market_settings"
      ADD COLUMN IF NOT EXISTS "business_hours_text_p_t" varchar,
      ADD COLUMN IF NOT EXISTS "business_hours_text_e_n" varchar,
      ADD COLUMN IF NOT EXISTS "angola_shipping_text_p_t" varchar,
      ADD COLUMN IF NOT EXISTS "angola_shipping_text_e_n" varchar,
      ADD COLUMN IF NOT EXISTS "portugal_shipping_text_p_t" varchar,
      ADD COLUMN IF NOT EXISTS "portugal_shipping_text_e_n" varchar,
      ADD COLUMN IF NOT EXISTS "international_shipping_text_p_t" varchar,
      ADD COLUMN IF NOT EXISTS "international_shipping_text_e_n" varchar;
  `)
}

export async function down({ db, payload: _payload, req: _req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "market_settings"
      DROP COLUMN IF EXISTS "business_hours_text_p_t",
      DROP COLUMN IF EXISTS "business_hours_text_e_n",
      DROP COLUMN IF EXISTS "angola_shipping_text_p_t",
      DROP COLUMN IF EXISTS "angola_shipping_text_e_n",
      DROP COLUMN IF EXISTS "portugal_shipping_text_p_t",
      DROP COLUMN IF EXISTS "portugal_shipping_text_e_n",
      DROP COLUMN IF EXISTS "international_shipping_text_p_t",
      DROP COLUMN IF EXISTS "international_shipping_text_e_n";
  `)
}
