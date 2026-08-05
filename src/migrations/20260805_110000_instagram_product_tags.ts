import { type MigrateDownArgs, type MigrateUpArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    -- Payload creates a relation table for globals even when the global has
    -- no explicit relationship field. Older Instagram spotlight migrations
    -- predated that table, so create it idempotently before querying the
    -- global with the new productTags array.
    CREATE TABLE IF NOT EXISTS "instagram_spotlight_rels" (
      "id" serial PRIMARY KEY NOT NULL,
      "order" integer,
      "parent_id" integer NOT NULL,
      "path" varchar NOT NULL
    );
    CREATE INDEX IF NOT EXISTS "instagram_spotlight_rels_parent_idx" ON "instagram_spotlight_rels" ("parent_id");
    DO $$ BEGIN
      ALTER TABLE "instagram_spotlight_rels"
        ADD CONSTRAINT "instagram_spotlight_rels_parent_fk"
        FOREIGN KEY ("parent_id") REFERENCES "public"."instagram_spotlight"("id")
        ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    CREATE TABLE IF NOT EXISTS "instagram_spotlight_product_tags" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "permalink" varchar NOT NULL
    );
    CREATE INDEX IF NOT EXISTS "instagram_spotlight_product_tags_order_idx" ON "instagram_spotlight_product_tags" ("_order");
    CREATE INDEX IF NOT EXISTS "instagram_spotlight_product_tags_parent_idx" ON "instagram_spotlight_product_tags" ("_parent_id");
    DO $$ BEGIN
      ALTER TABLE "instagram_spotlight_product_tags"
        ADD CONSTRAINT "instagram_spotlight_product_tags_parent_fk"
        FOREIGN KEY ("_parent_id") REFERENCES "public"."instagram_spotlight"("id")
        ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    CREATE TABLE IF NOT EXISTS "instagram_spotlight_product_tags_rels" (
      "id" serial PRIMARY KEY NOT NULL,
      "order" integer,
      "parent_id" varchar NOT NULL,
      "path" varchar NOT NULL,
      "products_id" integer
    );
    CREATE INDEX IF NOT EXISTS "instagram_spotlight_product_tags_rels_parent_idx" ON "instagram_spotlight_product_tags_rels" ("parent_id");
    CREATE INDEX IF NOT EXISTS "instagram_spotlight_product_tags_rels_products_idx" ON "instagram_spotlight_product_tags_rels" ("products_id");
    DO $$ BEGIN
      ALTER TABLE "instagram_spotlight_product_tags_rels"
        ADD CONSTRAINT "instagram_spotlight_product_tags_rels_products_fk"
        FOREIGN KEY ("products_id") REFERENCES "public"."products"("id")
        ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP TABLE IF EXISTS "instagram_spotlight_product_tags_rels" CASCADE;
    DROP TABLE IF EXISTS "instagram_spotlight_product_tags" CASCADE;
    DROP TABLE IF EXISTS "instagram_spotlight_rels" CASCADE;
  `)
}
