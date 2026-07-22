import { type MigrateDownArgs, type MigrateUpArgs, sql } from '@payloadcms/db-postgres'

// Payload's identifier mapper preserves each capital boundary, so namePT is
// stored as name_p_t (not name_pt). The preceding migration used the latter;
// this corrective migration is safe whether or not that release ran.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "products"
      ADD COLUMN IF NOT EXISTS "name_p_t" varchar,
      ADD COLUMN IF NOT EXISTS "name_e_n" varchar,
      ADD COLUMN IF NOT EXISTS "description_p_t" varchar,
      ADD COLUMN IF NOT EXISTS "description_e_n" varchar;

    UPDATE "products"
      SET "name_p_t" = COALESCE("name_p_t", "name"),
          "name_e_n" = COALESCE("name_e_n", "name"),
          "description_p_t" = COALESCE("description_p_t", "description");

    ALTER TABLE "products"
      DROP COLUMN IF EXISTS "description_en",
      DROP COLUMN IF EXISTS "description_pt",
      DROP COLUMN IF EXISTS "name_en",
      DROP COLUMN IF EXISTS "name_pt";
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "products"
      DROP COLUMN IF EXISTS "description_e_n",
      DROP COLUMN IF EXISTS "description_p_t",
      DROP COLUMN IF EXISTS "name_e_n",
      DROP COLUMN IF EXISTS "name_p_t";
  `)
}
