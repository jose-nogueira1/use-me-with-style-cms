import { type MigrateDownArgs, type MigrateUpArgs, sql } from '@payloadcms/db-postgres'

// Splits the combined `home-content` global into three independent globals
// -- HomeHero.ts, HomeCategories.ts, HomeCollections.ts -- each with its
// own save and its own version history (2026-08-04 admin feedback, after
// living with the combined "Previous versions" panel for a few hours: "I
// don't like the previous versions is a global preview of the whole home
// page... it should have previous versions of just each individually...
// creating each thing individually"). Editing Categories was dirtying and
// snapshotting Hero too, and the one shared version list mixed all three
// together with no way to tell what actually changed between entries.
//
// Column shapes below are copied verbatim from this project's own already-
// applied migrations for the equivalent fields on the OLD home_content /
// _home_content_v tables -- not hand-guessed:
//   - hero fields + hero_image_id:      20260725_190000_home_content.ts
//   - hero_cta_type/category/tag_slug:  20260731_150000_home_hero_cta_picker.ts
//   - version_updated_at/created_at:    20260725_233000_fix_home_content_versions_columns.ts
//   - home_content NOT NULL timestamps: 20260725_234000_fix_home_content_timestamps.ts
//   - array + versioned-array table shape (incl. the versioned table's
//     `serial` id + extra `_uuid` column): 20260804_170000_home_content_curation.ts
// home_hero/_home_hero_v are built with the FINAL (already-fixed) shape
// directly, rather than replaying that same history of small gaps again.
//
// Data is copied across from the existing single home_content row and its
// _home_content_v snapshot history -- nothing is lost. The old
// home_content / _home_content_v / home_content_homepage_category_slugs /
// home_content_collections / _home_content_v_version_* tables are
// deliberately NOT dropped here, matching this project's established
// convention for superseded-but-not-actively-harmful tables (see
// products.tag_id's precedent, sync-local-sqlite.mjs) -- safer to leave a
// verified-working backfill's source data in place than to delete it in
// the same migration that depends on it having been correct.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  // ---------------------------------------------------------------- Hero
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "home_hero" (
      "id" serial PRIMARY KEY NOT NULL,
      "hero_eyebrow_p_t" varchar DEFAULT 'Coleção SS26',
      "hero_eyebrow_e_n" varchar DEFAULT 'SS26 Collection',
      "hero_headline_p_t" varchar DEFAULT 'Moda que se move consigo.',
      "hero_headline_e_n" varchar DEFAULT 'Fashion that moves with you.',
      "hero_subtitle_p_t" varchar DEFAULT 'Peças pensadas para si, com preços sempre claros e diretos.',
      "hero_subtitle_e_n" varchar DEFAULT 'Considered pieces for you, with pricing always shown up front.',
      "hero_cta_label_p_t" varchar DEFAULT 'Ver tudo',
      "hero_cta_label_e_n" varchar DEFAULT 'Shop all',
      "hero_cta_type" varchar DEFAULT 'all',
      "hero_cta_category_slug" varchar,
      "hero_cta_tag_slug" varchar,
      "hero_image_id" integer,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );
    CREATE INDEX IF NOT EXISTS "home_hero_hero_image_idx" ON "home_hero" ("hero_image_id");
    CREATE INDEX IF NOT EXISTS "home_hero_updated_at_idx" ON "home_hero" ("updated_at");
    CREATE INDEX IF NOT EXISTS "home_hero_created_at_idx" ON "home_hero" ("created_at");
    DO $$ BEGIN
      ALTER TABLE "home_hero" ADD CONSTRAINT "home_hero_hero_image_id_media_id_fk"
        FOREIGN KEY ("hero_image_id") REFERENCES "media"("id") ON DELETE SET NULL;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;

    CREATE TABLE IF NOT EXISTS "_home_hero_v" (
      "id" serial PRIMARY KEY NOT NULL,
      "version_hero_eyebrow_p_t" varchar,
      "version_hero_eyebrow_e_n" varchar,
      "version_hero_headline_p_t" varchar,
      "version_hero_headline_e_n" varchar,
      "version_hero_subtitle_p_t" varchar,
      "version_hero_subtitle_e_n" varchar,
      "version_hero_cta_label_p_t" varchar,
      "version_hero_cta_label_e_n" varchar,
      "version_hero_cta_type" varchar DEFAULT 'all',
      "version_hero_cta_category_slug" varchar,
      "version_hero_cta_tag_slug" varchar,
      "version_hero_image_id" integer,
      "version_updated_at" timestamp(3) with time zone,
      "version_created_at" timestamp(3) with time zone,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );
    CREATE INDEX IF NOT EXISTS "_home_hero_v_version_hero_image_idx" ON "_home_hero_v" ("version_hero_image_id");
    CREATE INDEX IF NOT EXISTS "_home_hero_v_created_at_idx" ON "_home_hero_v" ("created_at");
    CREATE INDEX IF NOT EXISTS "_home_hero_v_updated_at_idx" ON "_home_hero_v" ("updated_at");
    DO $$ BEGIN
      ALTER TABLE "_home_hero_v" ADD CONSTRAINT "_home_hero_v_version_hero_image_id_media_id_fk"
        FOREIGN KEY ("version_hero_image_id") REFERENCES "media"("id") ON DELETE SET NULL;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
  `)

  // Backfill from the old combined table. Guarded on home_hero being empty
  // so re-running this migration (it shouldn't, payload_migrations tracks
  // it by name, but this is a data migration -- worth the extra safety)
  // can't double-insert.
  await db.execute(sql`
    INSERT INTO "home_hero" (
      "hero_eyebrow_p_t", "hero_eyebrow_e_n", "hero_headline_p_t", "hero_headline_e_n",
      "hero_subtitle_p_t", "hero_subtitle_e_n", "hero_cta_label_p_t", "hero_cta_label_e_n",
      "hero_cta_type", "hero_cta_category_slug", "hero_cta_tag_slug", "hero_image_id",
      "updated_at", "created_at"
    )
    SELECT
      "hero_eyebrow_p_t", "hero_eyebrow_e_n", "hero_headline_p_t", "hero_headline_e_n",
      "hero_subtitle_p_t", "hero_subtitle_e_n", "hero_cta_label_p_t", "hero_cta_label_e_n",
      "hero_cta_type", "hero_cta_category_slug", "hero_cta_tag_slug", "hero_image_id",
      "updated_at", "created_at"
    FROM "home_content"
    WHERE NOT EXISTS (SELECT 1 FROM "home_hero");

    INSERT INTO "_home_hero_v" (
      "version_hero_eyebrow_p_t", "version_hero_eyebrow_e_n", "version_hero_headline_p_t", "version_hero_headline_e_n",
      "version_hero_subtitle_p_t", "version_hero_subtitle_e_n", "version_hero_cta_label_p_t", "version_hero_cta_label_e_n",
      "version_hero_cta_type", "version_hero_cta_category_slug", "version_hero_cta_tag_slug", "version_hero_image_id",
      "version_updated_at", "version_created_at", "created_at", "updated_at"
    )
    SELECT
      "version_hero_eyebrow_p_t", "version_hero_eyebrow_e_n", "version_hero_headline_p_t", "version_hero_headline_e_n",
      "version_hero_subtitle_p_t", "version_hero_subtitle_e_n", "version_hero_cta_label_p_t", "version_hero_cta_label_e_n",
      "version_hero_cta_type", "version_hero_cta_category_slug", "version_hero_cta_tag_slug", "version_hero_image_id",
      "version_updated_at", "version_created_at", "created_at", "updated_at"
    FROM "_home_content_v"
    WHERE NOT EXISTS (SELECT 1 FROM "_home_hero_v");
  `)

  // ----------------------------------------------------------- Categories
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "home_categories" (
      "id" serial PRIMARY KEY NOT NULL,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );
    CREATE INDEX IF NOT EXISTS "home_categories_updated_at_idx" ON "home_categories" ("updated_at");
    CREATE INDEX IF NOT EXISTS "home_categories_created_at_idx" ON "home_categories" ("created_at");

    CREATE TABLE IF NOT EXISTS "home_categories_homepage_category_slugs" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "slug" varchar NOT NULL
    );
    CREATE INDEX IF NOT EXISTS "home_categories_homepage_category_slugs_order_idx" ON "home_categories_homepage_category_slugs" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "home_categories_homepage_category_slugs_parent_id_idx" ON "home_categories_homepage_category_slugs" USING btree ("_parent_id");
    DO $$ BEGIN
      ALTER TABLE "home_categories_homepage_category_slugs" ADD CONSTRAINT "home_categories_homepage_category_slugs_parent_id_fk"
        FOREIGN KEY ("_parent_id") REFERENCES "public"."home_categories"("id") ON DELETE cascade;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;

    CREATE TABLE IF NOT EXISTS "_home_categories_v" (
      "id" serial PRIMARY KEY NOT NULL,
      "version_updated_at" timestamp(3) with time zone,
      "version_created_at" timestamp(3) with time zone,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );
    CREATE INDEX IF NOT EXISTS "_home_categories_v_created_at_idx" ON "_home_categories_v" ("created_at");
    CREATE INDEX IF NOT EXISTS "_home_categories_v_updated_at_idx" ON "_home_categories_v" ("updated_at");

    CREATE TABLE IF NOT EXISTS "_home_categories_v_version_homepage_category_slugs" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" serial PRIMARY KEY NOT NULL,
      "slug" varchar NOT NULL,
      "_uuid" varchar
    );
    CREATE INDEX IF NOT EXISTS "_home_categories_v_version_homepage_category_slugs_order_idx" ON "_home_categories_v_version_homepage_category_slugs" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "_home_categories_v_version_homepage_category_slugs_parent_id_idx" ON "_home_categories_v_version_homepage_category_slugs" USING btree ("_parent_id");
    DO $$ BEGIN
      ALTER TABLE "_home_categories_v_version_homepage_category_slugs" ADD CONSTRAINT "_home_categories_v_version_homepage_category_slugs_parent_id_fk"
        FOREIGN KEY ("_parent_id") REFERENCES "public"."_home_categories_v"("id") ON DELETE cascade;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
  `)

  // Backfill: home_content is a single-row global, so home_categories ends
  // up single-row too -- safe to look it up with a plain subquery rather
  // than a data-modifying CTE. Versions need a temporary passenger column
  // to correlate old _home_content_v.id -> new _home_categories_v.id
  // across the INSERT, since the new table's id is a fresh `serial` (must
  // NOT reuse the old numeric id -- it would collide with that column's
  // own sequence the first time a real save creates a new version row).
  await db.execute(sql`
    INSERT INTO "home_categories" ("updated_at", "created_at")
    SELECT "updated_at", "created_at" FROM "home_content"
    WHERE NOT EXISTS (SELECT 1 FROM "home_categories");

    INSERT INTO "home_categories_homepage_category_slugs" ("_order", "_parent_id", "id", "slug")
    SELECT c."_order", (SELECT "id" FROM "home_categories" LIMIT 1), c."id", c."slug"
    FROM "home_content_homepage_category_slugs" c
    WHERE NOT EXISTS (SELECT 1 FROM "home_categories_homepage_category_slugs");

    ALTER TABLE "_home_categories_v" ADD COLUMN IF NOT EXISTS "_migration_old_id" integer;

    INSERT INTO "_home_categories_v" ("version_updated_at", "version_created_at", "created_at", "updated_at", "_migration_old_id")
    SELECT "version_updated_at", "version_created_at", "created_at", "updated_at", "id"
    FROM "_home_content_v"
    WHERE NOT EXISTS (SELECT 1 FROM "_home_categories_v");

    INSERT INTO "_home_categories_v_version_homepage_category_slugs" ("_order", "_parent_id", "slug", "_uuid")
    SELECT c."_order", n."id", c."slug", c."_uuid"
    FROM "_home_content_v_version_homepage_category_slugs" c
    JOIN "_home_categories_v" n ON n."_migration_old_id" = c."_parent_id";

    ALTER TABLE "_home_categories_v" DROP COLUMN IF EXISTS "_migration_old_id";
  `)

  // ----------------------------------------------------------- Collections
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "home_collections" (
      "id" serial PRIMARY KEY NOT NULL,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );
    CREATE INDEX IF NOT EXISTS "home_collections_updated_at_idx" ON "home_collections" ("updated_at");
    CREATE INDEX IF NOT EXISTS "home_collections_created_at_idx" ON "home_collections" ("created_at");

    CREATE TABLE IF NOT EXISTS "home_collections_collections" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "tag_slug" varchar NOT NULL,
      "title_p_t" varchar NOT NULL,
      "title_e_n" varchar NOT NULL,
      "item_limit" numeric DEFAULT 8
    );
    CREATE INDEX IF NOT EXISTS "home_collections_collections_order_idx" ON "home_collections_collections" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "home_collections_collections_parent_id_idx" ON "home_collections_collections" USING btree ("_parent_id");
    DO $$ BEGIN
      ALTER TABLE "home_collections_collections" ADD CONSTRAINT "home_collections_collections_parent_id_fk"
        FOREIGN KEY ("_parent_id") REFERENCES "public"."home_collections"("id") ON DELETE cascade;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;

    CREATE TABLE IF NOT EXISTS "_home_collections_v" (
      "id" serial PRIMARY KEY NOT NULL,
      "version_updated_at" timestamp(3) with time zone,
      "version_created_at" timestamp(3) with time zone,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );
    CREATE INDEX IF NOT EXISTS "_home_collections_v_created_at_idx" ON "_home_collections_v" ("created_at");
    CREATE INDEX IF NOT EXISTS "_home_collections_v_updated_at_idx" ON "_home_collections_v" ("updated_at");

    CREATE TABLE IF NOT EXISTS "_home_collections_v_version_collections" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" serial PRIMARY KEY NOT NULL,
      "tag_slug" varchar NOT NULL,
      "title_p_t" varchar NOT NULL,
      "title_e_n" varchar NOT NULL,
      "item_limit" numeric DEFAULT 8,
      "_uuid" varchar
    );
    CREATE INDEX IF NOT EXISTS "_home_collections_v_version_collections_order_idx" ON "_home_collections_v_version_collections" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "_home_collections_v_version_collections_parent_id_idx" ON "_home_collections_v_version_collections" USING btree ("_parent_id");
    DO $$ BEGIN
      ALTER TABLE "_home_collections_v_version_collections" ADD CONSTRAINT "_home_collections_v_version_collections_parent_id_fk"
        FOREIGN KEY ("_parent_id") REFERENCES "public"."_home_collections_v"("id") ON DELETE cascade;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
  `)

  await db.execute(sql`
    INSERT INTO "home_collections" ("updated_at", "created_at")
    SELECT "updated_at", "created_at" FROM "home_content"
    WHERE NOT EXISTS (SELECT 1 FROM "home_collections");

    INSERT INTO "home_collections_collections" ("_order", "_parent_id", "id", "tag_slug", "title_p_t", "title_e_n", "item_limit")
    SELECT c."_order", (SELECT "id" FROM "home_collections" LIMIT 1), c."id", c."tag_slug", c."title_p_t", c."title_e_n", c."item_limit"
    FROM "home_content_collections" c
    WHERE NOT EXISTS (SELECT 1 FROM "home_collections_collections");

    ALTER TABLE "_home_collections_v" ADD COLUMN IF NOT EXISTS "_migration_old_id" integer;

    INSERT INTO "_home_collections_v" ("version_updated_at", "version_created_at", "created_at", "updated_at", "_migration_old_id")
    SELECT "version_updated_at", "version_created_at", "created_at", "updated_at", "id"
    FROM "_home_content_v"
    WHERE NOT EXISTS (SELECT 1 FROM "_home_collections_v");

    INSERT INTO "_home_collections_v_version_collections" ("_order", "_parent_id", "tag_slug", "title_p_t", "title_e_n", "item_limit", "_uuid")
    SELECT c."_order", n."id", c."tag_slug", c."title_p_t", c."title_e_n", c."item_limit", c."_uuid"
    FROM "_home_content_v_version_collections" c
    JOIN "_home_collections_v" n ON n."_migration_old_id" = c."_parent_id";

    ALTER TABLE "_home_collections_v" DROP COLUMN IF EXISTS "_migration_old_id";
  `)
}

// Drops only the three NEW tables-sets this migration created. The OLD
// home_content / _home_content_v tables were never touched by up() (see
// this file's header), so there's nothing to restore them from -- down()
// just removes what up() added.
export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP TABLE IF EXISTS "_home_hero_v" CASCADE;
    DROP TABLE IF EXISTS "home_hero" CASCADE;
    DROP TABLE IF EXISTS "_home_categories_v_version_homepage_category_slugs" CASCADE;
    DROP TABLE IF EXISTS "_home_categories_v" CASCADE;
    DROP TABLE IF EXISTS "home_categories_homepage_category_slugs" CASCADE;
    DROP TABLE IF EXISTS "home_categories" CASCADE;
    DROP TABLE IF EXISTS "_home_collections_v_version_collections" CASCADE;
    DROP TABLE IF EXISTS "_home_collections_v" CASCADE;
    DROP TABLE IF EXISTS "home_collections_collections" CASCADE;
    DROP TABLE IF EXISTS "home_collections" CASCADE;
  `)
}
