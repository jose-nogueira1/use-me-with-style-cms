import { type MigrateDownArgs, type MigrateUpArgs, sql } from '@payloadcms/db-postgres'

// Homepage curation (2026-08-04, user request: "how does the admin choose
// which categories are present in the homepage and which merchandising tag
// is also on the homepage. Admin should have total control here" -- plus a
// follow-up: "think about me having a new collection, lets say summer ss26,
// I should be able to feature it with the tag SS26, like we have featured
// and new arrivals now"). Adds two new array fields to the home-content
// global, HomeContent.ts:
//   - homepageCategorySlugs: which categories show in the homepage category
//     row, and in what order. Empty -> Home.tsx (platform) falls back to
//     showing every category, exactly today's behaviour.
//   - collections: any number of admin-defined, tag-driven shelves (title +
//     merch tag + item limit), generalising the old hardcoded "New
//     Arrivals" (whichever tag happened to be literally named "New") and
//     "Featured" (first 8 products, no tag logic at all) into something an
//     admin can fully configure -- e.g. add a "Summer SS26" shelf bound to
//     an "ss26" tag with no code changes. Empty -> same fallback as above.
//
// Both are purely additive new child tables (Payload's Postgres adapter
// represents an array field as its own `_parent_id`-linked rows table, same
// pattern as products_variants/orders_items) -- nothing on the existing
// home_content/_home_content_v columns changes, so there's nothing to
// backfill.
//
// Shape confirmed the same way the tags/hero migrations were (see
// push-merch-tags-cms.sh's header): generated the FULL schema `payload
// migrate:create` produces for the updated HomeContent.ts against an empty
// database, and took the CREATE TABLE statements for exactly these 4 new
// tables (2 live + their _home_content_v_version_* versioned counterparts,
// since versions.max: 20 is enabled on this global) verbatim from that
// output -- notably, the versioned tables use a `serial` id plus an extra
// `_uuid` column (how Payload preserves array-row identity across version
// snapshots), which is not something to guess by hand.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "home_content_homepage_category_slugs" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "slug" varchar NOT NULL
    );
    CREATE TABLE IF NOT EXISTS "home_content_collections" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "tag_slug" varchar NOT NULL,
      "title_p_t" varchar NOT NULL,
      "title_e_n" varchar NOT NULL,
      "item_limit" numeric DEFAULT 8
    );
    CREATE TABLE IF NOT EXISTS "_home_content_v_version_homepage_category_slugs" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" serial PRIMARY KEY NOT NULL,
      "slug" varchar NOT NULL,
      "_uuid" varchar
    );
    CREATE TABLE IF NOT EXISTS "_home_content_v_version_collections" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" serial PRIMARY KEY NOT NULL,
      "tag_slug" varchar NOT NULL,
      "title_p_t" varchar NOT NULL,
      "title_e_n" varchar NOT NULL,
      "item_limit" numeric DEFAULT 8,
      "_uuid" varchar
    );

    CREATE INDEX IF NOT EXISTS "home_content_homepage_category_slugs_order_idx" ON "home_content_homepage_category_slugs" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "home_content_homepage_category_slugs_parent_id_idx" ON "home_content_homepage_category_slugs" USING btree ("_parent_id");
    CREATE INDEX IF NOT EXISTS "home_content_collections_order_idx" ON "home_content_collections" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "home_content_collections_parent_id_idx" ON "home_content_collections" USING btree ("_parent_id");
    CREATE INDEX IF NOT EXISTS "_home_content_v_version_homepage_category_slugs_order_idx" ON "_home_content_v_version_homepage_category_slugs" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "_home_content_v_version_homepage_category_slugs_parent_id_idx" ON "_home_content_v_version_homepage_category_slugs" USING btree ("_parent_id");
    CREATE INDEX IF NOT EXISTS "_home_content_v_version_collections_order_idx" ON "_home_content_v_version_collections" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "_home_content_v_version_collections_parent_id_idx" ON "_home_content_v_version_collections" USING btree ("_parent_id");
  `)

  await db.execute(sql`
    DO $$ BEGIN
      ALTER TABLE "home_content_homepage_category_slugs" ADD CONSTRAINT "home_content_homepage_category_slugs_parent_id_fk"
        FOREIGN KEY ("_parent_id") REFERENCES "public"."home_content"("id") ON DELETE cascade;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
    DO $$ BEGIN
      ALTER TABLE "home_content_collections" ADD CONSTRAINT "home_content_collections_parent_id_fk"
        FOREIGN KEY ("_parent_id") REFERENCES "public"."home_content"("id") ON DELETE cascade;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
    DO $$ BEGIN
      ALTER TABLE "_home_content_v_version_homepage_category_slugs" ADD CONSTRAINT "_home_content_v_version_homepage_category_slugs_parent_id_fk"
        FOREIGN KEY ("_parent_id") REFERENCES "public"."_home_content_v"("id") ON DELETE cascade;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
    DO $$ BEGIN
      ALTER TABLE "_home_content_v_version_collections" ADD CONSTRAINT "_home_content_v_version_collections_parent_id_fk"
        FOREIGN KEY ("_parent_id") REFERENCES "public"."_home_content_v"("id") ON DELETE cascade;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP TABLE IF EXISTS "home_content_homepage_category_slugs" CASCADE;
    DROP TABLE IF EXISTS "home_content_collections" CASCADE;
    DROP TABLE IF EXISTS "_home_content_v_version_homepage_category_slugs" CASCADE;
    DROP TABLE IF EXISTS "_home_content_v_version_collections" CASCADE;
  `)
}
