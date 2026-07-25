import { type MigrateDownArgs, type MigrateUpArgs, sql } from '@payloadcms/db-postgres'

// Two-tone combination colours (2026-07-25 admin follow-up): an optional
// second hex value so a single Colours doc (e.g. "Vermelho & Branco") can
// render as a split-circle swatch. Everything else about the colour --
// id, namePT/nameEN, how variants/cart/orders reference it -- is unchanged;
// this is purely an additional rendering hint.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "colors" ADD COLUMN IF NOT EXISTS "hex2" varchar;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "colors" DROP COLUMN IF EXISTS "hex2";
  `)
}
