import { type MigrateDownArgs, type MigrateUpArgs, sql } from '@payloadcms/db-postgres'

// Adds an independently cropped 4:5 mobile hero while preserving the
// existing 16:9 desktop relationship. Existing rows remain valid and the
// storefront falls back to hero_image_id until an admin saves a mobile crop.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "home_hero" ADD COLUMN IF NOT EXISTS "hero_image_mobile_id" integer;
    CREATE INDEX IF NOT EXISTS "home_hero_hero_image_mobile_idx" ON "home_hero" ("hero_image_mobile_id");
    DO $$ BEGIN
      ALTER TABLE "home_hero" ADD CONSTRAINT "home_hero_hero_image_mobile_id_media_id_fk"
        FOREIGN KEY ("hero_image_mobile_id") REFERENCES "media"("id") ON DELETE SET NULL;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;

    ALTER TABLE "_home_hero_v" ADD COLUMN IF NOT EXISTS "version_hero_image_mobile_id" integer;
    CREATE INDEX IF NOT EXISTS "_home_hero_v_version_hero_image_mobile_idx" ON "_home_hero_v" ("version_hero_image_mobile_id");
    DO $$ BEGIN
      ALTER TABLE "_home_hero_v" ADD CONSTRAINT "_home_hero_v_version_hero_image_mobile_id_media_id_fk"
        FOREIGN KEY ("version_hero_image_mobile_id") REFERENCES "media"("id") ON DELETE SET NULL;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "_home_hero_v" DROP CONSTRAINT IF EXISTS "_home_hero_v_version_hero_image_mobile_id_media_id_fk";
    DROP INDEX IF EXISTS "_home_hero_v_version_hero_image_mobile_idx";
    ALTER TABLE "_home_hero_v" DROP COLUMN IF EXISTS "version_hero_image_mobile_id";

    ALTER TABLE "home_hero" DROP CONSTRAINT IF EXISTS "home_hero_hero_image_mobile_id_media_id_fk";
    DROP INDEX IF EXISTS "home_hero_hero_image_mobile_idx";
    ALTER TABLE "home_hero" DROP COLUMN IF EXISTS "hero_image_mobile_id";
  `)
}
