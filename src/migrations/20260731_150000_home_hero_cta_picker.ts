import { type MigrateDownArgs, type MigrateUpArgs, sql } from '@payloadcms/db-postgres'

// Home hero CTA becomes a picker instead of a free-text URL (2026-07-31
// admin bug report: hero promoted an "SS26" collection but the button sent
// shoppers to the full catalogue). heroCtaHref was a plain text field --
// nothing stopped it drifting from whatever tag/category slug it was
// supposed to point at, and the storefront couldn't tell "intentionally
// points at everything" apart from "supposed to be scoped but broken".
//
// Replaced with heroCtaType ('all' | 'category' | 'tag') plus
// heroCtaCategorySlug/heroCtaTagSlug, both driven by dropdowns in the admin
// UI (Settings.tsx) sourced from the real Categories/MerchTags lists, so a
// bad value can no longer be typed in. Backfill is best-effort: parses the
// existing heroCtaHref's ?cat=/?tag= query param (if any) into the new
// shape, defaulting to 'all' for anything else (including the plain
// "/catalogo" default nearly everyone still has).
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "home_content" ADD COLUMN IF NOT EXISTS "hero_cta_type" varchar DEFAULT 'all';
    ALTER TABLE "home_content" ADD COLUMN IF NOT EXISTS "hero_cta_category_slug" varchar;
    ALTER TABLE "home_content" ADD COLUMN IF NOT EXISTS "hero_cta_tag_slug" varchar;
  `)

  await db.execute(sql`
    DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'home_content' AND column_name = 'hero_cta_href') THEN
        UPDATE "home_content" SET
          "hero_cta_type" = CASE
            WHEN "hero_cta_href" LIKE '%?tag=%' OR "hero_cta_href" LIKE '%&tag=%' THEN 'tag'
            WHEN "hero_cta_href" LIKE '%?cat=%' OR "hero_cta_href" LIKE '%&cat=%' THEN 'category'
            ELSE 'all'
          END,
          "hero_cta_tag_slug" = CASE
            WHEN "hero_cta_href" LIKE '%tag=%'
              THEN split_part(split_part("hero_cta_href", 'tag=', 2), '&', 1)
            ELSE NULL
          END,
          "hero_cta_category_slug" = CASE
            WHEN "hero_cta_href" LIKE '%cat=%'
              THEN split_part(split_part("hero_cta_href", 'cat=', 2), '&', 1)
            ELSE NULL
          END;
      END IF;
    END $$;
  `)

  await db.execute(sql`
    ALTER TABLE "home_content" DROP COLUMN IF EXISTS "hero_cta_href";
  `)

  await db.execute(sql`
    ALTER TABLE "_home_content_v" ADD COLUMN IF NOT EXISTS "version_hero_cta_type" varchar DEFAULT 'all';
    ALTER TABLE "_home_content_v" ADD COLUMN IF NOT EXISTS "version_hero_cta_category_slug" varchar;
    ALTER TABLE "_home_content_v" ADD COLUMN IF NOT EXISTS "version_hero_cta_tag_slug" varchar;
  `)

  await db.execute(sql`
    DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = '_home_content_v' AND column_name = 'version_hero_cta_href') THEN
        UPDATE "_home_content_v" SET
          "version_hero_cta_type" = CASE
            WHEN "version_hero_cta_href" LIKE '%?tag=%' OR "version_hero_cta_href" LIKE '%&tag=%' THEN 'tag'
            WHEN "version_hero_cta_href" LIKE '%?cat=%' OR "version_hero_cta_href" LIKE '%&cat=%' THEN 'category'
            ELSE 'all'
          END,
          "version_hero_cta_tag_slug" = CASE
            WHEN "version_hero_cta_href" LIKE '%tag=%'
              THEN split_part(split_part("version_hero_cta_href", 'tag=', 2), '&', 1)
            ELSE NULL
          END,
          "version_hero_cta_category_slug" = CASE
            WHEN "version_hero_cta_href" LIKE '%cat=%'
              THEN split_part(split_part("version_hero_cta_href", 'cat=', 2), '&', 1)
            ELSE NULL
          END;
      END IF;
    END $$;
  `)

  await db.execute(sql`
    ALTER TABLE "_home_content_v" DROP COLUMN IF EXISTS "version_hero_cta_href";
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "home_content" ADD COLUMN IF NOT EXISTS "hero_cta_href" varchar DEFAULT '/catalogo';
  `)
  await db.execute(sql`
    UPDATE "home_content" SET "hero_cta_href" =
      CASE
        WHEN "hero_cta_type" = 'tag' AND "hero_cta_tag_slug" IS NOT NULL THEN '/catalogo?tag=' || "hero_cta_tag_slug"
        WHEN "hero_cta_type" = 'category' AND "hero_cta_category_slug" IS NOT NULL THEN '/catalogo?cat=' || "hero_cta_category_slug"
        ELSE '/catalogo'
      END;
  `)
  await db.execute(sql`
    ALTER TABLE "home_content" DROP COLUMN IF EXISTS "hero_cta_type";
    ALTER TABLE "home_content" DROP COLUMN IF EXISTS "hero_cta_category_slug";
    ALTER TABLE "home_content" DROP COLUMN IF EXISTS "hero_cta_tag_slug";
  `)

  await db.execute(sql`
    ALTER TABLE "_home_content_v" ADD COLUMN IF NOT EXISTS "version_hero_cta_href" varchar DEFAULT '/catalogo';
  `)
  await db.execute(sql`
    UPDATE "_home_content_v" SET "version_hero_cta_href" =
      CASE
        WHEN "version_hero_cta_type" = 'tag' AND "version_hero_cta_tag_slug" IS NOT NULL THEN '/catalogo?tag=' || "version_hero_cta_tag_slug"
        WHEN "version_hero_cta_type" = 'category' AND "version_hero_cta_category_slug" IS NOT NULL THEN '/catalogo?cat=' || "version_hero_cta_category_slug"
        ELSE '/catalogo'
      END;
  `)
  await db.execute(sql`
    ALTER TABLE "_home_content_v" DROP COLUMN IF EXISTS "version_hero_cta_type";
    ALTER TABLE "_home_content_v" DROP COLUMN IF EXISTS "version_hero_cta_category_slug";
    ALTER TABLE "_home_content_v" DROP COLUMN IF EXISTS "version_hero_cta_tag_slug";
  `)
}
