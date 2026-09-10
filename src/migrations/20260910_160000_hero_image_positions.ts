import { type MigrateDownArgs, type MigrateUpArgs, sql } from '@payloadcms/db-postgres'

// Defaults preserve the framing of existing heroes and historical versions.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "home_hero" ADD COLUMN IF NOT EXISTS "hero_desktop_position_x" numeric DEFAULT 65;
    ALTER TABLE "home_hero" ADD COLUMN IF NOT EXISTS "hero_desktop_position_y" numeric DEFAULT 20;
    ALTER TABLE "home_hero" ADD COLUMN IF NOT EXISTS "hero_mobile_position_x" numeric DEFAULT 50;
    ALTER TABLE "home_hero" ADD COLUMN IF NOT EXISTS "hero_mobile_position_y" numeric DEFAULT 50;
    ALTER TABLE "_home_hero_v" ADD COLUMN IF NOT EXISTS "version_hero_desktop_position_x" numeric DEFAULT 65;
    ALTER TABLE "_home_hero_v" ADD COLUMN IF NOT EXISTS "version_hero_desktop_position_y" numeric DEFAULT 20;
    ALTER TABLE "_home_hero_v" ADD COLUMN IF NOT EXISTS "version_hero_mobile_position_x" numeric DEFAULT 50;
    ALTER TABLE "_home_hero_v" ADD COLUMN IF NOT EXISTS "version_hero_mobile_position_y" numeric DEFAULT 50;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "_home_hero_v" DROP COLUMN IF EXISTS "version_hero_desktop_position_x";
    ALTER TABLE "_home_hero_v" DROP COLUMN IF EXISTS "version_hero_desktop_position_y";
    ALTER TABLE "_home_hero_v" DROP COLUMN IF EXISTS "version_hero_mobile_position_x";
    ALTER TABLE "_home_hero_v" DROP COLUMN IF EXISTS "version_hero_mobile_position_y";
    ALTER TABLE "home_hero" DROP COLUMN IF EXISTS "hero_desktop_position_x";
    ALTER TABLE "home_hero" DROP COLUMN IF EXISTS "hero_desktop_position_y";
    ALTER TABLE "home_hero" DROP COLUMN IF EXISTS "hero_mobile_position_x";
    ALTER TABLE "home_hero" DROP COLUMN IF EXISTS "hero_mobile_position_y";
  `)
}
