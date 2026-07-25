import { type MigrateDownArgs, type MigrateUpArgs, sql } from '@payloadcms/db-postgres'

// Category tile images (2026-07-25 admin request): the home page's
// category tiles ("Vestidos"/"Tops"/"Leggings"/"Conjuntos") were a
// decorative placeholder with no admin-editable source. Optional upload,
// same relationship shape as Colors.swatch.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "image_id" integer;
    CREATE INDEX IF NOT EXISTS "categories_image_idx" ON "categories" ("image_id");
    DO $$ BEGIN
      ALTER TABLE "categories" ADD CONSTRAINT "categories_image_id_media_id_fk"
        FOREIGN KEY ("image_id") REFERENCES "media"("id") ON DELETE SET NULL;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "categories" DROP COLUMN IF EXISTS "image_id";
  `)
}
