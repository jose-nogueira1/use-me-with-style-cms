import { sql, type MigrateDownArgs, type MigrateUpArgs } from '@payloadcms/db-postgres'

const sizeNames = ['small', 'medium', 'large', 'hero'] as const

/** Columns Payload reads/writes for each generated image size. */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  for (const name of sizeNames) {
    await db.execute(sql.raw(`
      ALTER TABLE "media"
        ADD COLUMN IF NOT EXISTS "sizes_${name}_url" varchar,
        ADD COLUMN IF NOT EXISTS "sizes_${name}_width" numeric,
        ADD COLUMN IF NOT EXISTS "sizes_${name}_height" numeric,
        ADD COLUMN IF NOT EXISTS "sizes_${name}_mime_type" varchar,
        ADD COLUMN IF NOT EXISTS "sizes_${name}_filesize" numeric,
        ADD COLUMN IF NOT EXISTS "sizes_${name}_filename" varchar;
      CREATE INDEX IF NOT EXISTS "media_sizes_${name}_filename_idx"
        ON "media" USING btree ("sizes_${name}_filename");
    `))
  }
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  for (const name of [...sizeNames].reverse()) {
    await db.execute(sql.raw(`
      DROP INDEX IF EXISTS "media_sizes_${name}_filename_idx";
      ALTER TABLE "media"
        DROP COLUMN IF EXISTS "sizes_${name}_url",
        DROP COLUMN IF EXISTS "sizes_${name}_width",
        DROP COLUMN IF EXISTS "sizes_${name}_height",
        DROP COLUMN IF EXISTS "sizes_${name}_mime_type",
        DROP COLUMN IF EXISTS "sizes_${name}_filesize",
        DROP COLUMN IF EXISTS "sizes_${name}_filename";
    `))
  }
}
