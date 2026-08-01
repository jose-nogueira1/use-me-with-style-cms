import { type MigrateDownArgs, type MigrateUpArgs, sql } from '@payloadcms/db-postgres'

// Fixes a self-inflicted production outage: the two new dataDeletionTextPT/EN
// fields added to the legal-content global (LegalContent.ts) were never
// accompanied by a migration, so the live `legal_content` table never got
// the matching columns. Payload's generated SELECT for the global still
// references them, so *every* read of this global has been failing with a
// 500 -- not just the new field, but Privacy Policy and Terms too, since
// they're read from the same row. Confirmed live: usemewithstyle.shop
// /politica-privacidade was stuck on "A carregar..." forever.
//
// Column names verified via `to-snake-case` up front (same lesson as
// 20260724_170000_legal_content's own comment): PT/EN suffixes split into
// `_p_t` / `_e_n`, one underscore per letter.
//
// IF NOT EXISTS on the add (not a bare ADD COLUMN) because Railway may have
// partially retried this deploy before -- same defensive pattern as the
// 20260731_140000 incident earlier this session.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "legal_content" ADD COLUMN IF NOT EXISTS "data_deletion_text_p_t" varchar;
    ALTER TABLE "legal_content" ADD COLUMN IF NOT EXISTS "data_deletion_text_e_n" varchar;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "legal_content" DROP COLUMN IF EXISTS "data_deletion_text_p_t";
    ALTER TABLE "legal_content" DROP COLUMN IF EXISTS "data_deletion_text_e_n";
  `)
}
