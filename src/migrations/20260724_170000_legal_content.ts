import { type MigrateDownArgs, type MigrateUpArgs, sql } from '@payloadcms/db-postgres'

// New global (Privacy Policy + Terms & Conditions, user request 2026-07-24).
// A brand-new table, not a rename of anything existing, so there's no
// acronym-splitting ambiguity to resolve here -- still verified the PT/EN
// column names up front via `node -e "require('to-snake-case')(...)"` before
// writing this (same lesson as 20260724_150000): trailing two-letter
// suffixes split into `_p_t` / `_e_n`, one underscore per letter, not `_pt`.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "legal_content" (
      "id" serial PRIMARY KEY NOT NULL,
      "privacy_policy_text_p_t" varchar,
      "privacy_policy_text_e_n" varchar,
      "terms_text_p_t" varchar,
      "terms_text_e_n" varchar,
      "updated_at" timestamp(3) with time zone,
      "created_at" timestamp(3) with time zone
    );
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP TABLE IF EXISTS "legal_content" CASCADE;
  `)
}
