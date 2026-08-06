import { sql, type MigrateDownArgs, type MigrateUpArgs } from '@payloadcms/db-postgres'

/**
 * Production retained a legacy `colors.name` column after colours moved to
 * the bilingual `name_p_t` / `name_e_n` fields. Because that stale column
 * was still NOT NULL, Payload omitted it from inserts and every new colour
 * failed with a database error. The bilingual column is authoritative, so
 * the legacy duplicate can be removed safely.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "colors" DROP COLUMN IF EXISTS "name";
  `)
}

/** The removed column is obsolete application drift and must not return. */
export async function down(_args: MigrateDownArgs): Promise<void> {}
