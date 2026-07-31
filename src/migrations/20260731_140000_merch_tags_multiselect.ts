import { sql, type MigrateDownArgs, type MigrateUpArgs } from '@payloadcms/db-postgres'

// Merchandising tags become multi-select on products (2026-07-31 admin bug
// report: "I can only select one merchandising tag per item" -- a product
// can legitimately be both e.g. "Novidade" and "Bestseller" at once).
//
// products.tag changes from a single relationship (stored as a plain
// tag_id column on products) to hasMany: true. Payload's Postgres adapter
// stores hasMany relationships in a shared "<collection>_rels" join table
// rather than a column -- confirmed by generating a full schema snapshot
// from the post-change config against an empty database (the same
// technique this repo's other migrations are written against) and diffing
// it: products_rels(id, order, parent_id, path, merch_tags_id), one row per
// selected tag, "path" holding the field name so the table can be shared by
// future hasMany/relationship fields on products without collision.
//
// Data mapping (lossless): each product's existing tag_id, if any, becomes
// a single products_rels row (order 1, path 'tag'). Nothing is lost --
// every product keeps exactly the one tag it had, just in the new shape.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "products_rels" (
      "id" serial PRIMARY KEY NOT NULL,
      "order" integer,
      "parent_id" integer NOT NULL,
      "path" varchar NOT NULL,
      "merch_tags_id" integer
    );
    -- Self-heal a partial-state production incident (found 2026-08-01, live
    -- crash-loop): "products_rels" already existed WITHOUT "merch_tags_id"
    -- by the time this migration first got a chance to run against real
    -- Postgres -- every deploy since has hit "column merch_tags_id does not
    -- exist" on the CREATE INDEX below and crashed on startup, since
    -- CREATE TABLE IF NOT EXISTS is a no-op against an already-existing
    -- table and this migration never wrapped its statements in a
    -- transaction, so nothing here was atomic across restarts. ADD COLUMN
    -- IF NOT EXISTS is a no-op on a fresh table (already has the column
    -- from CREATE TABLE above) and fixes exactly the broken state
    -- otherwise -- same "recovers from the production partial state"
    -- pattern this repo's other migrations already use (see
    -- postgresMigrations.test.ts).
    ALTER TABLE "products_rels" ADD COLUMN IF NOT EXISTS "merch_tags_id" integer;
    CREATE INDEX IF NOT EXISTS "products_rels_order_idx" ON "products_rels" ("order");
    CREATE INDEX IF NOT EXISTS "products_rels_parent_idx" ON "products_rels" ("parent_id");
    CREATE INDEX IF NOT EXISTS "products_rels_path_idx" ON "products_rels" ("path");
    CREATE INDEX IF NOT EXISTS "products_rels_merch_tags_id_idx" ON "products_rels" ("merch_tags_id");
    DO $$ BEGIN
      ALTER TABLE "products_rels" ADD CONSTRAINT "products_rels_parent_fk"
        FOREIGN KEY ("parent_id") REFERENCES "products"("id") ON DELETE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
    DO $$ BEGIN
      ALTER TABLE "products_rels" ADD CONSTRAINT "products_rels_merch_tags_fk"
        FOREIGN KEY ("merch_tags_id") REFERENCES "merch_tags"("id") ON DELETE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
  `)

  await db.execute(sql`
    -- Backfill: one row per product that already had a tag. Guarded so this
    -- only runs while the old column is still there, and ON CONFLICT-free
    -- de-dup via NOT EXISTS so re-running this migration (or recovering from
    -- a partial prior run, per this repo's established incident pattern --
    -- see 20260725_150000) never double-inserts the same tag twice.
    DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'tag_id') THEN
        INSERT INTO "products_rels" ("order", "parent_id", "path", "merch_tags_id")
        SELECT 1, p."id", 'tag', p."tag_id"
        FROM "products" p
        WHERE p."tag_id" IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM "products_rels" r
            WHERE r."parent_id" = p."id" AND r."path" = 'tag' AND r."merch_tags_id" = p."tag_id"
          );
      END IF;
    END $$;
  `)

  await db.execute(sql`
    -- Old single-value storage, now fully migrated.
    ALTER TABLE "products" DROP CONSTRAINT IF EXISTS "products_tag_id_merch_tags_id_fk";
    DROP INDEX IF EXISTS "products_tag_idx";
    ALTER TABLE "products" DROP COLUMN IF EXISTS "tag_id";
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "tag_id" integer;
  `)

  await db.execute(sql`
    -- Rolling back to single-select is inherently lossy for any product that
    -- picked up a second tag after this migration ran -- there is nowhere in
    -- the old shape to put more than one. Deterministically keeps the
    -- LOWEST-order (first-picked) tag per product, which is the one that
    -- existed before this migration for every product that hasn't been
    -- edited since.
    DO $$ BEGIN
      IF to_regclass('public.products_rels') IS NOT NULL THEN
        UPDATE "products" p
          SET "tag_id" = sub."merch_tags_id"
          FROM (
            SELECT DISTINCT ON (r."parent_id") r."parent_id", r."merch_tags_id"
            FROM "products_rels" r
            WHERE r."path" = 'tag' AND r."merch_tags_id" IS NOT NULL
            ORDER BY r."parent_id", r."order" ASC NULLS LAST, r."id" ASC
          ) sub
          WHERE sub."parent_id" = p."id";
      END IF;
    END $$;
  `)

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "products_tag_idx" ON "products" ("tag_id");
    DO $$ BEGIN
      ALTER TABLE "products" ADD CONSTRAINT "products_tag_id_merch_tags_id_fk"
        FOREIGN KEY ("tag_id") REFERENCES "merch_tags"("id") ON DELETE SET NULL;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
    DROP TABLE IF EXISTS "products_rels";
  `)
}
