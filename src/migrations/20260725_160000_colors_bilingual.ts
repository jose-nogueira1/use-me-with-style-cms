import { type MigrateDownArgs, type MigrateUpArgs, sql } from '@payloadcms/db-postgres'
import { PT_COLOR_PRESETS } from '../lib/colorPresets'

// Colours become bilingual (2026-07-25 admin request, follow-up to the
// same-day catalogue-taxonomies migration): Colors.name -> namePT (rename,
// lossless) + new optional nameEN, mirroring Categories/MerchTags.
//
// Also adds orders.items[].colorId: order items' `color` field can no
// longer double as a language-independent identity once it's allowed to
// hold either language's name, so inventory reservation now matches
// variants by this stable colour-row id instead (see
// lib/inventoryReservation.ts). Nullable/additive -- existing order rows
// simply have no colorId, and the reservation code falls back to the old
// name-based match for those.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "colors" RENAME COLUMN "name" TO "name_p_t";
    ALTER TABLE "colors" ADD COLUMN IF NOT EXISTS "name_e_n" varchar;

    ${sql.raw(
      Object.entries(PT_COLOR_PRESETS)
        .map(
          ([name, preset]) =>
            `UPDATE "colors" SET "name_e_n" = '${preset.nameEN.replace(/'/g, "''")}' WHERE "name_e_n" IS NULL AND lower(trim("name_p_t")) = '${name.replace(/'/g, "''")}';`,
        )
        .join('\n    '),
    )}

    ALTER TABLE "orders_items" ADD COLUMN IF NOT EXISTS "color_id" varchar;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "orders_items" DROP COLUMN IF EXISTS "color_id";
    ALTER TABLE "colors" DROP COLUMN IF EXISTS "name_e_n";
    ALTER TABLE "colors" RENAME COLUMN "name_p_t" TO "name";
  `)
}
